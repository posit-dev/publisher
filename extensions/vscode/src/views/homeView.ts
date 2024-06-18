// Copyright (C) 2024 by Posit Software, PBC.

import {
  CancellationToken,
  Disposable,
  ExtensionContext,
  ThemeIcon,
  Uri,
  ViewColumn,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
  WorkspaceFolder,
  commands,
  window,
  workspace,
} from "vscode";
import { isAxiosError } from "axios";

import {
  Configuration,
  ConfigurationError,
  Credential,
  ContentRecord,
  EventStreamMessage,
  FileAction,
  PreContentRecord,
  PreContentRecordWithConfig,
  isConfigurationError,
  isContentRecordError,
  isPreContentRecord,
  isPreContentRecordWithConfig,
  useApi,
} from "src/api";
import { useBus } from "src/bus";
import { EventStream } from "src/events";
import { getPythonInterpreterPath } from "../utils/config";
import { getSummaryStringFromError } from "src/utils/errors";
import { getNonce } from "src/utils/getNonce";
import { getUri } from "src/utils/getUri";
import { deployProject } from "src/views/deployProgress";
import { WebviewConduit } from "src/utils/webviewConduit";
import { fileExists } from "src/utils/files";
import { newDeployment } from "src/multiStepInputs/newDeployment";

import type { DeploymentNames, HomeViewState } from "src/types/shared";
import {
  DeployMsg,
  EditConfigurationMsg,
  NavigateMsg,
  SaveSelectionStatedMsg,
  WebviewToHostMessage,
  WebviewToHostMessageType,
  VSCodeOpenRelativeMsg,
} from "src/types/messages/webviewToHostMessages";
import { HostToWebviewMessageType } from "src/types/messages/hostToWebviewMessages";
import { confirmOverwrite } from "src/dialogs";
import { splitFilesOnInclusion } from "src/utils/files";
import { DeploymentQuickPick } from "src/types/quickPicks";
import { normalizeURL } from "src/utils/url";
import { selectConfig } from "src/multiStepInputs/selectConfig";
import { RPackage, RVersionConfig } from "src/api/types/packages";
import { calculateTitle } from "src/utils/titles";
import { ConfigWatcherManager, WatcherManager } from "src/watchers";
import { openUrl } from "src/utils/browser";
import { Commands, Views } from "src/constants";

const contextIsHomeViewInitialized = "posit.publisher.homeView.initialized";

enum HomeViewInitialized {
  initialized = "initialized",
  uninitialized = "uninitialized",
}

const lastSelectionState = "posit.publisher.homeView.lastSelectionState.v2";

export class HomeViewProvider implements WebviewViewProvider, Disposable {
  private _disposables: Disposable[] = [];
  private _contentRecords: (
    | ContentRecord
    | PreContentRecord
    | PreContentRecordWithConfig
  )[] = [];

  private _credentials: Credential[] = [];
  private _configs: Configuration[] = [];
  private configsInError: ConfigurationError[] = [];
  private root: WorkspaceFolder | undefined;
  private _webviewView?: WebviewView;
  private _extensionUri: Uri;
  private _webviewConduit: WebviewConduit;

  private configWatchers: ConfigWatcherManager | undefined;

  constructor(
    private readonly _context: ExtensionContext,
    private readonly _stream: EventStream,
  ) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
    this._extensionUri = this._context.extensionUri;
    this._webviewConduit = new WebviewConduit();

    // if someone needs a refresh of any active params,
    // we are here to service that request!
    useBus().on("refreshCredentials", async () => {
      await this._refreshCredentialData();
      this._updateWebViewViewCredentials();
    });
    useBus().on("requestActiveConfig", () => {
      useBus().trigger("activeConfigChanged", this._getActiveConfig());
    });
    useBus().on("requestActiveContentRecord", () => {
      useBus().trigger(
        "activeContentRecordChanged",
        this._getActiveContentRecord(),
      );
    });

    useBus().on("activeConfigChanged", (cfg) => {
      this.sendRefreshedFilesLists();
      this._onRefreshPythonPackages();
      this._onRefreshRPackages();

      this.configWatchers?.dispose();
      this.configWatchers = new ConfigWatcherManager(cfg);

      this.configWatchers.configFile?.onDidChange(
        this.sendRefreshedFilesLists,
        this,
      );

      this.configWatchers.pythonPackageFile?.onDidCreate(
        this._onRefreshPythonPackages,
        this,
      );
      this.configWatchers.pythonPackageFile?.onDidChange(
        this._onRefreshPythonPackages,
        this,
      );
      this.configWatchers.pythonPackageFile?.onDidDelete(
        this._onRefreshPythonPackages,
        this,
      );

      this.configWatchers.rPackageFile?.onDidCreate(
        this._onRefreshRPackages,
        this,
      );
      this.configWatchers.rPackageFile?.onDidChange(
        this._onRefreshRPackages,
        this,
      );
      this.configWatchers.rPackageFile?.onDidDelete(
        this._onRefreshRPackages,
        this,
      );
    });
  }
  /**
   * Dispatch messages passed from the webview to the handling code
   */
  private async _onConduitMessage(msg: WebviewToHostMessage) {
    switch (msg.kind) {
      case WebviewToHostMessageType.DEPLOY:
        return await this._onDeployMsg(msg);
      case WebviewToHostMessageType.INITIALIZING:
        return await this._onInitializingMsg();
      case WebviewToHostMessageType.EDIT_CONFIGURATION:
        return await this._onEditConfigurationMsg(msg);
      case WebviewToHostMessageType.NEW_CONFIGURATION:
        return await this._onNewConfigurationMsg();
      case WebviewToHostMessageType.SELECT_CONFIGURATION:
        return await this.selectConfigForDeployment();
      case WebviewToHostMessageType.NAVIGATE:
        return await this._onNavigateMsg(msg);
      case WebviewToHostMessageType.SAVE_SELECTION_STATE:
        return await this._onSaveSelectionState(msg);
      case WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES:
        return await this._onRefreshPythonPackages();
      case WebviewToHostMessageType.REFRESH_R_PACKAGES:
        return await this._onRefreshRPackages();
      case WebviewToHostMessageType.VSCODE_OPEN_RELATIVE:
        return await this._onRelativeOpenVSCode(msg);
      case WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS:
        return await this._onScanForPythonPackageRequirements();
      case WebviewToHostMessageType.SCAN_R_PACKAGE_REQUIREMENTS:
        return await this._onScanForRPackageRequirements();
      case WebviewToHostMessageType.VSCODE_OPEN:
        return commands.executeCommand(
          "vscode.open",
          Uri.parse(msg.content.uri),
        );
      case WebviewToHostMessageType.REQUEST_FILES_LISTS:
        return this.sendRefreshedFilesLists();
      case WebviewToHostMessageType.INCLUDE_FILE:
        return this.updateFileList(msg.content.path, FileAction.INCLUDE);
      case WebviewToHostMessageType.EXCLUDE_FILE:
        return this.updateFileList(msg.content.path, FileAction.EXCLUDE);
      case WebviewToHostMessageType.SELECT_DEPLOYMENT:
        return this.showDeploymentQuickPick();
      case WebviewToHostMessageType.NEW_DEPLOYMENT:
        return this.showNewDeploymentMultiStep(Views.HomeView);
      case WebviewToHostMessageType.NEW_CREDENTIAL:
        return this.showNewCredential();
      default:
        throw new Error(
          `Error: _onConduitMessage unhandled msg: ${JSON.stringify(msg)}`,
        );
    }
  }

  private async _onDeployMsg(msg: DeployMsg) {
    try {
      const api = await useApi();
      const response = await api.contentRecords.publish(
        msg.content.deploymentName,
        msg.content.credentialName,
        msg.content.configurationName,
      );
      deployProject(response.data.localId, this._stream);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("homeView, deploy", error);
      window.showInformationMessage(`Failed to deploy . ${summary}`);
    }
  }

  private async _onInitializingMsg() {
    // send back the data needed.
    await this.refreshAll(true);
    this.setInitializationContext(HomeViewInitialized.initialized);

    // On first run, we have no saved state. Trigger a save
    // so we have the state, and can notify dependent views.
    this._requestWebviewSaveSelection();
  }

  private setInitializationContext(context: HomeViewInitialized) {
    commands.executeCommand(
      "setContext",
      contextIsHomeViewInitialized,
      context,
    );
  }

  private async _onEditConfigurationMsg(msg: EditConfigurationMsg) {
    let config: Configuration | ConfigurationError | undefined;
    config = this._configs.find(
      (config) => config.configurationName === msg.content.configurationName,
    );
    if (!config) {
      config = this.configsInError.find(
        (config) => config.configurationName === msg.content.configurationName,
      );
    }
    if (config) {
      await commands.executeCommand(
        "vscode.open",
        Uri.file(config.configurationPath),
      );
    }
  }

  private async _onNewConfigurationMsg() {
    await commands.executeCommand(Commands.Configurations.New, Views.HomeView);
  }

  private async _onNavigateMsg(msg: NavigateMsg) {
    await openUrl(msg.content.uriPath);
  }

  private async _onSaveSelectionState(msg: SaveSelectionStatedMsg) {
    await this._saveSelectionState(msg.content.state);
  }

  private async updateFileList(uri: string, action: FileAction) {
    const activeConfig = this._getActiveConfig();
    if (activeConfig === undefined) {
      console.error("homeView::updateFileList: No active configuration.");
      return;
    }

    try {
      const api = await useApi();
      await api.files.updateFileList(
        activeConfig.configurationName,
        uri,
        action,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::updateFileList",
        error,
      );
      window.showErrorMessage(`Failed to update config file. ${summary}`);
      return;
    }
  }

  private _onPublishStart() {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.PUBLISH_START,
    });
  }

  private _onPublishSuccess() {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS,
    });
  }

  private _onPublishFailure(msg: EventStreamMessage) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.PUBLISH_FINISH_FAILURE,
      content: {
        data: {
          message: msg.data.message,
        },
      },
    });
  }

  private async _refreshContentRecordData() {
    try {
      // API Returns:
      // 200 - success
      // 500 - internal server error
      const api = await useApi();
      const response = await api.contentRecords.getAll();
      const contentRecords = response.data;
      this._contentRecords = [];
      contentRecords.forEach((contentRecord) => {
        if (!isContentRecordError(contentRecord)) {
          this._contentRecords.push(contentRecord);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "_refreshContentRecordData::contentRecords.getAll",
        error,
      );
      window.showInformationMessage(summary);
      throw error;
    }
  }

  private async _refreshConfigurationData() {
    try {
      const api = await useApi();
      const response = await api.configurations.getAll();
      const configurations = response.data;
      this._configs = [];
      this.configsInError = [];
      configurations.forEach((config) => {
        if (!isConfigurationError(config)) {
          this._configs.push(config);
        } else {
          this.configsInError.push(config);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "_refreshConfigurationData::configurations.getAll",
        error,
      );
      window.showInformationMessage(summary);
      throw error;
    }
  }

  private async _refreshCredentialData() {
    try {
      const api = await useApi();
      const response = await api.credentials.list();
      this._credentials = response.data;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "_refreshCredentialData::credentials.list",
        error,
      );
      window.showInformationMessage(summary);
      throw error;
    }
  }

  private _updateWebViewViewContentRecords(
    selectedContentRecordName?: string | null,
  ) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CONTENTRECORD_DATA,
      content: {
        contentRecords: this._contentRecords,
        selectedContentRecordName,
      },
    });
  }

  private _updateWebViewViewConfigurations(
    selectedConfigurationName?: string | null,
  ) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CONFIG_DATA,
      content: {
        configurations: this._configs,
        configurationsInError: this.configsInError,
        selectedConfigurationName,
      },
    });
  }

  private _updateWebViewViewCredentials() {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA,
      content: {
        credentials: this._credentials,
      },
    });
  }

  private _requestWebviewSaveSelection() {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.SAVE_SELECTION,
    });
  }

  private _getSelectionState(): HomeViewState {
    const state = this._context.workspaceState.get<HomeViewState>(
      lastSelectionState,
      {
        deploymentName: undefined,
        configurationName: undefined,
      },
    );
    return state;
  }

  private _getActiveConfig(): Configuration | undefined {
    const savedState = this._getSelectionState();
    return this.getConfigByName(savedState.configurationName);
  }

  private _getActiveContentRecord():
    | ContentRecord
    | PreContentRecord
    | undefined {
    const savedState = this._getSelectionState();
    return this.getContentRecordByName(savedState.deploymentName);
  }

  private getContentRecordByName(name: string | undefined) {
    return this._contentRecords.find((d) => d.deploymentName === name);
  }

  private getConfigByName(name: string | undefined) {
    return this._configs.find((c) => c.configurationName === name);
  }

  private async _saveSelectionState(state: HomeViewState): Promise<void> {
    await this._context.workspaceState.update(lastSelectionState, state);

    useBus().trigger(
      "activeContentRecordChanged",
      this._getActiveContentRecord(),
    );
    useBus().trigger("activeConfigChanged", this._getActiveConfig());
  }

  private async _onRefreshPythonPackages() {
    const savedState = this._getSelectionState();
    const activeConfiguration = savedState.configurationName;
    let pythonProject = true;
    let packages: string[] = [];
    let packageFile: string | undefined;
    let packageMgr: string | undefined;

    const api = await useApi();

    if (activeConfiguration) {
      const currentConfig = this.getConfigByName(activeConfiguration);
      const pythonSection = currentConfig?.configuration.python;
      if (!pythonSection) {
        pythonProject = false;
      } else {
        try {
          packageFile = pythonSection.packageFile;
          packageMgr = pythonSection.packageManager;

          const response =
            await api.packages.getPythonPackages(activeConfiguration);
          packages = response.data.requirements;
        } catch (error: unknown) {
          if (isAxiosError(error) && error.response?.status === 404) {
            // No requirements file or contains invalid entries; show the welcome view.
            packageFile = undefined;
          } else if (isAxiosError(error) && error.response?.status === 422) {
            // invalid package file
            packageFile = undefined;
          } else if (isAxiosError(error) && error.response?.status === 409) {
            // Python is not present in the configuration file
            pythonProject = false;
          } else {
            const summary = getSummaryStringFromError(
              "homeView::_onRefreshPythonPackages",
              error,
            );
            window.showInformationMessage(summary);
            return;
          }
        }
      }
    }
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES,
      content: {
        pythonProject,
        file: packageFile,
        manager: packageMgr,
        packages,
      },
    });
  }

  private async _onRefreshRPackages() {
    const savedState = this._getSelectionState();
    const activeConfiguration = savedState.configurationName;
    let rProject = true;
    let packages: RPackage[] = [];
    let packageFile: string | undefined;
    let packageMgr: string | undefined;
    let rVersionConfig: RVersionConfig | undefined;

    const api = await useApi();

    if (activeConfiguration) {
      const currentConfig = this.getConfigByName(activeConfiguration);
      const rSection = currentConfig?.configuration.r;
      if (!rSection) {
        rProject = false;
      } else {
        try {
          packageFile = rSection.packageFile;
          packageMgr = rSection.packageManager;

          const response = await api.packages.getRPackages(activeConfiguration);
          packages = [];
          Object.keys(response.data.packages).forEach((key: string) =>
            packages.push(response.data.packages[key]),
          );
          rVersionConfig = response.data.r;
        } catch (error: unknown) {
          if (isAxiosError(error) && error.response?.status === 404) {
            // No requirements file; show the welcome view.
            packageFile = undefined;
          } else if (isAxiosError(error) && error.response?.status === 422) {
            // invalid package file
            packageFile = undefined;
          } else if (isAxiosError(error) && error.response?.status === 409) {
            // R is not present in the configuration file
            rProject = false;
          } else {
            const summary = getSummaryStringFromError(
              "homeView::_onRefreshRPackages",
              error,
            );
            window.showInformationMessage(summary);
            return;
          }
        }
      }
    }
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.UPDATE_R_PACKAGES,
      content: {
        rProject,
        file: packageFile,
        manager: packageMgr,
        rVersion: rVersionConfig?.version,
        packages,
      },
    });
  }

  private async _onRelativeOpenVSCode(msg: VSCodeOpenRelativeMsg) {
    if (this.root === undefined) {
      return;
    }
    const fileUri = Uri.joinPath(this.root.uri, msg.content.relativePath);
    await commands.executeCommand("vscode.open", fileUri);
  }

  private async _onScanForPythonPackageRequirements() {
    if (this.root === undefined) {
      // We shouldn't get here if there's no workspace folder open.
      return;
    }
    const activeConfiguration = this._getActiveConfig();
    const relPathPackageFile =
      activeConfiguration?.configuration.python?.packageFile;
    if (relPathPackageFile === undefined) {
      return;
    }

    const fileUri = Uri.joinPath(this.root.uri, relPathPackageFile);

    if (await fileExists(fileUri)) {
      const ok = await confirmOverwrite(
        `Are you sure you want to overwrite your existing ${relPathPackageFile} file?`,
      );
      if (!ok) {
        return;
      }
    }

    try {
      const api = await useApi();
      const python = await getPythonInterpreterPath();
      await api.packages.createPythonRequirementsFile(
        python,
        relPathPackageFile,
      );
      await commands.executeCommand("vscode.open", fileUri);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::_onScanForPythonPackageRequirements",
        error,
      );
      window.showInformationMessage(summary);
    }
  }

  private async _onScanForRPackageRequirements() {
    if (this.root === undefined) {
      // We shouldn't get here if there's no workspace folder open.
      return;
    }
    const activeConfiguration = this._getActiveConfig();
    const relPathPackageFile =
      activeConfiguration?.configuration.r?.packageFile;
    if (relPathPackageFile === undefined) {
      return;
    }

    const fileUri = Uri.joinPath(this.root.uri, relPathPackageFile);

    if (await fileExists(fileUri)) {
      const ok = await confirmOverwrite(
        `Are you sure you want to overwrite your existing ${relPathPackageFile} file?`,
      );
      if (!ok) {
        return;
      }
    }

    try {
      const api = await useApi();
      await api.packages.createRRequirementsFile(relPathPackageFile);
      await commands.executeCommand("vscode.open", fileUri);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::_onScanForRPackageRequirements",
        error,
      );
      window.showInformationMessage(summary);
    }
  }

  private async propogateDeploymentSelection(
    configurationName?: string,
    deploymentName?: string,
  ) {
    // We have to break our protocol and go ahead and write this into storage,
    // in case this multi-stepper is actually running ahead of the webview
    // being brought up.
    this._saveSelectionState({
      deploymentName,
      configurationName,
    });
    // Now push down into the webview
    this._updateWebViewViewCredentials();
    this._updateWebViewViewConfigurations(configurationName);
    this._updateWebViewViewContentRecords(deploymentName);
    // And have the webview save what it has selected.
    this._requestWebviewSaveSelection();
  }

  private async selectConfigForDeployment() {
    const activeDeployment = this._getActiveContentRecord();
    if (activeDeployment === undefined) {
      console.error(
        "homeView::selectConfigForDeployment: No active deployment.",
      );
      return;
    }
    const config = await selectConfig(activeDeployment, Views.HomeView);
    if (config) {
      const api = await useApi();
      await api.contentRecords.patch(
        activeDeployment.deploymentName,
        config.configurationName,
      );
    }
  }

  private async createConfigForDeployment() {
    const activeDeployment = this._getActiveContentRecord();
    if (activeDeployment === undefined) {
      console.error(
        "homeView::createConfigForDestination: No active deployment.",
      );
      return;
    }
    // selectConfig handles create as well
    const config = await selectConfig(activeDeployment, Views.HomeView);
    if (config) {
      const activeContentRecord = this._getActiveContentRecord();
      if (activeContentRecord === undefined) {
        console.error(
          "homeView::selectConfigForDeployment: No active deployment.",
        );
        return;
      }
      const api = await useApi();
      await api.contentRecords.patch(
        activeContentRecord.deploymentName,
        config.configurationName,
      );
    }
  }

  public async showNewDeploymentMultiStep(
    viewId?: string,
  ): Promise<DeploymentNames | undefined> {
    const deploymentObjects = await newDeployment(viewId);
    if (deploymentObjects) {
      // add out new objects into our collections possibly ahead (we don't know) of
      // the file refresh activity (for contentRecord and config)
      // and the credential refresh that we will kick off
      //
      // Doing this as an alternative to forcing a full refresh
      // of all three APIs prior to updating the UX, which would
      // be seen as a visible delay (we'd have to have a progress indicator).
      let refreshCredentials = false;
      if (
        !this._contentRecords.find(
          (contentRecord) =>
            contentRecord.saveName === deploymentObjects.contentRecord.saveName,
        )
      ) {
        this._contentRecords.push(deploymentObjects.contentRecord);
      }
      if (
        !this._configs.find(
          (config) =>
            config.configurationName ===
            deploymentObjects.configuration.configurationName,
        )
      ) {
        this._configs.push(deploymentObjects.configuration);
      }
      if (
        !this._credentials.find(
          (credential) => credential.name === deploymentObjects.credential.name,
        )
      ) {
        this._credentials.push(deploymentObjects.credential);
        refreshCredentials = true;
      }

      this.propogateDeploymentSelection(
        deploymentObjects.configuration.configurationName,
        deploymentObjects.contentRecord.saveName,
      );
      // Credentials aren't auto-refreshed, so we have to trigger it ourselves.
      if (refreshCredentials) {
        useBus().trigger("refreshCredentials", undefined);
      }
      return {
        configurationName: deploymentObjects.configuration.configurationName,
        deploymentName: deploymentObjects.contentRecord.saveName,
      };
    }
    return undefined;
  }

  private showNewCredential() {
    const contentRecord = this._getActiveContentRecord();

    return commands.executeCommand(
      Commands.Credentials.Add,
      contentRecord?.serverUrl,
    );
  }

  private async showDeploymentQuickPick(): Promise<
    DeploymentNames | undefined
  > {
    // Create quick pick list from current contentRecords, credentials and configs
    const deployments: DeploymentQuickPick[] = [];
    const lastContentRecordName = this._getActiveContentRecord()?.saveName;
    const lastConfigName = this._getActiveConfig()?.configurationName;

    this._contentRecords.forEach((contentRecord) => {
      if (
        isContentRecordError(contentRecord) ||
        (isPreContentRecord(contentRecord) &&
          !isPreContentRecordWithConfig(contentRecord))
      ) {
        // we won't include these for now. Perhaps in the future, we can show them
        // as disabled.
        return;
      }

      let config: Configuration | undefined;
      if (contentRecord.configurationName) {
        config = this._configs.find(
          (config) =>
            config.configurationName === contentRecord.configurationName,
        );
      }

      let credential = this._credentials.find(
        (credential) =>
          normalizeURL(credential.url).toLowerCase() ===
          normalizeURL(contentRecord.serverUrl).toLowerCase(),
      );

      const result = calculateTitle(contentRecord, config);
      const title = result.title;
      let problem = result.problem;

      let configName = config?.configurationName;
      if (!configName) {
        configName = contentRecord.configurationName
          ? `Missing Configuration ${contentRecord.configurationName}`
          : `ERROR: No Config Entry in Deployment record - ${contentRecord.saveName}`;
        problem = true;
      }

      let detail = credential?.name;
      if (!credential?.name) {
        detail = `Missing Credential for ${contentRecord.serverUrl}`;
        problem = true;
      }

      let lastMatch =
        lastContentRecordName === contentRecord.saveName &&
        lastConfigName === configName;

      const deployment: DeploymentQuickPick = {
        label: title,
        detail,
        iconPath: problem
          ? new ThemeIcon("error")
          : new ThemeIcon("cloud-upload"),
        contentRecord,
        config,
        lastMatch,
      };
      // Should we not push deployments with no config or matching credentials?
      deployments.push(deployment);
    });

    const toDispose: Disposable[] = [];
    const deployment = await new Promise<DeploymentQuickPick | undefined>(
      (resolve) => {
        const quickPick = window.createQuickPick<DeploymentQuickPick>();
        this._disposables.push(quickPick);

        quickPick.items = deployments;
        const lastMatches = deployments.filter(
          (deployment) => deployment.lastMatch,
        );
        if (lastMatches) {
          quickPick.activeItems = lastMatches;
        }
        quickPick.title = "Select Deployment";
        quickPick.ignoreFocusOut = true;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        quickPick.show();

        quickPick.onDidAccept(
          () => {
            quickPick.hide();
            if (quickPick.selectedItems.length > 0) {
              return resolve(quickPick.selectedItems[0]);
            }
            resolve(undefined);
          },
          undefined,
          toDispose,
        );
        quickPick.onDidHide(() => resolve(undefined), undefined, toDispose);
      },
    ).finally(() => Disposable.from(...toDispose).dispose());

    let result: DeploymentNames | undefined;
    if (deployment) {
      result = {
        deploymentName: deployment.contentRecord.saveName,
        configurationName: deployment.contentRecord.configurationName,
      };
      this._updateWebViewViewCredentials();
      this._updateWebViewViewConfigurations(result.configurationName);
      this._updateWebViewViewContentRecords(result.deploymentName);
      this._requestWebviewSaveSelection();
    }
    return result;
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _: WebviewViewResolveContext,
    _token: CancellationToken,
  ) {
    this._webviewView = webviewView;
    this._webviewConduit.init(this._webviewView.webview);

    // Allow scripts in the webview
    webviewView.webview.options = {
      // Enable JavaScript in the webview
      enableScripts: true,
      // Restrict the webview to only load resources from these directories
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, "webviews", "homeView", "dist"),
        Uri.joinPath(
          this._extensionUri,
          "node_modules",
          "@vscode",
          "codicons",
          "dist",
        ),
      ],
    };

    // Set the HTML content that will fill the webview view
    webviewView.webview.html = this._getWebviewContent(
      webviewView.webview,
      this._extensionUri,
    );

    // Sets up an event listener to listen for messages passed from the webview view this._context
    // and executes code based on the message that is recieved
    this._disposables.push(
      this._webviewConduit.onMsg(this._onConduitMessage.bind(this)),
    );
  }
  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where references to the Vue webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS files from the Vue build output
    const stylesUri = getUri(webview, extensionUri, [
      "webviews",
      "homeView",
      "dist",
      "index.css",
    ]);
    // The JS file from the Vue build output
    const scriptUri = getUri(webview, extensionUri, [
      "webviews",
      "homeView",
      "dist",
      "index.js",
    ]);
    // The codicon css (and related tff file) are needing to be loaded for icons
    const codiconsUri = getUri(webview, extensionUri, [
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css",
    ]);

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy"
            content="
              default-src 'none';
              font-src ${webview.cspSource};
              style-src ${webview.cspSource} 'unsafe-inline';
              script-src 'nonce-${nonce}';"
          />
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <link rel="stylesheet" type="text/css" href="${codiconsUri}">
          <title>Hello World</title>
        </head>
        <body>
          <div id="app"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  public refreshAll = async (includeSavedState?: boolean) => {
    try {
      await Promise.all([
        this._refreshContentRecordData(),
        this._refreshConfigurationData(),
        this._refreshCredentialData(),
      ]);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "refreshAll::Promise.all",
        error,
      );
      window.showInformationMessage(summary);
      return;
    }
    const selectionState = includeSavedState
      ? this._getSelectionState()
      : undefined;
    this._updateWebViewViewCredentials();
    this._updateWebViewViewConfigurations(
      selectionState?.configurationName || null,
    );
    this._updateWebViewViewContentRecords(
      selectionState?.deploymentName || null,
    );
    if (includeSavedState && selectionState) {
      useBus().trigger(
        "activeContentRecordChanged",
        this._getActiveContentRecord(),
      );
      useBus().trigger("activeConfigChanged", this._getActiveConfig());
    }
  };

  public refreshContentRecords = async () => {
    await this._refreshContentRecordData();
    this._updateWebViewViewContentRecords();
    useBus().trigger(
      "activeContentRecordChanged",
      this._getActiveContentRecord(),
    );
  };

  public refreshConfigurations = async () => {
    await this._refreshConfigurationData();
    this._updateWebViewViewConfigurations();
    useBus().trigger("activeConfigChanged", this._getActiveConfig());
  };

  public sendRefreshedFilesLists = async () => {
    const api = await useApi();
    const activeConfig = this._getActiveConfig();
    if (activeConfig) {
      const response = await api.files.getByConfiguration(
        activeConfig.configurationName,
      );

      this._webviewConduit.sendMsg({
        kind: HostToWebviewMessageType.REFRESH_FILES_LISTS,
        content: {
          ...splitFilesOnInclusion(response.data),
        },
      });
    }
  };

  /**
   * Cleans up and disposes of webview resources when view is disposed
   */
  public dispose() {
    Disposable.from(...this._disposables).dispose();

    this.configWatchers?.dispose();
  }

  public register(watchers: WatcherManager) {
    this._stream.register("publish/start", () => {
      this._onPublishStart();
    });
    this._stream.register("publish/success", () => {
      this._onPublishSuccess();
    });
    this._stream.register("publish/failure", (msg: EventStreamMessage) => {
      this._onPublishFailure(msg);
    });

    this._context.subscriptions.push(
      window.registerWebviewViewProvider(Views.HomeView, this, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        Commands.HomeView.SelectDeployment,
        this.showDeploymentQuickPick,
        this,
      ),
      commands.registerCommand(
        Commands.HomeView.NewDeployment,
        () => this.showNewDeploymentMultiStep(Views.HomeView),
        this,
      ),
      commands.registerCommand(Commands.HomeView.Refresh, () =>
        this.refreshAll(true),
      ),
      commands.registerCommand(
        Commands.HomeView.SelectConfigForDeployment,
        this.selectConfigForDeployment,
        this,
      ),
      commands.registerCommand(
        Commands.HomeView.CreateConfigForDeployment,
        this.createConfigForDeployment,
        this,
      ),
      commands.registerCommand(
        Commands.HomeView.NavigateToDeploymentServer,
        async () => {
          const deployment = this._getActiveContentRecord();
          if (deployment) {
            await openUrl(deployment.serverUrl);
          }
        },
      ),
      commands.registerCommand(
        Commands.HomeView.NavigateToDeploymentContent,
        async () => {
          const contentRecord = this._getActiveContentRecord();
          if (contentRecord && !isPreContentRecord(contentRecord)) {
            // was contentRecord.dashboardUrl
            await openUrl(contentRecord.directUrl);
          }
        },
      ),
      commands.registerCommand(Commands.HomeView.ShowContentLogs, async () => {
        const contentRecord = this._getActiveContentRecord();
        if (contentRecord && !isPreContentRecord(contentRecord)) {
          await openUrl(`${contentRecord.dashboardUrl}/logs`);
        }
      }),
      commands.registerCommand(
        Commands.HomeView.LoadContent,
        (contentURL?: string, viewColumn?: ViewColumn) => {
          if (!contentURL) {
            const activeContentRecord = this._getActiveContentRecord();
            if (
              activeContentRecord &&
              !isPreContentRecord(activeContentRecord)
            ) {
              contentURL = activeContentRecord.directUrl;
            }
          }
          if (!contentURL) {
            return;
          }
          if (!viewColumn) {
            viewColumn = ViewColumn.Beside;
          }
          // Create and show panel
          const panel = window.createWebviewPanel(
            Commands.HomeView.ContentBrowser,
            "Content Browser",
            {
              viewColumn,
              preserveFocus: false,
            },
            {
              enableScripts: true,
              enableForms: true,
              enableCommandUris: true,
            },
          );

          // And set its HTML content
          panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        		<meta charset="UTF-8">
        		<meta name="viewport" content="width=device-width, height=device-height, initial-scale=1.0">
        </head>
        <body>
        		<iframe
        			style="width: 100%; min-height: 1000px;"
        			src="${contentURL}"
        			sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin allow-top-navigation allow-frame-ancestors"
        		/>
        </body>
        </html>`;
        },
      ),
      commands.registerCommand(
        Commands.Files.Refresh,
        this.sendRefreshedFilesLists,
        this,
      ),
      commands.registerCommand(
        Commands.PythonPackages.Edit,
        async () => {
          if (this.root === undefined) {
            return;
          }
          const cfg = this._getActiveConfig();
          const packageFile = cfg?.configuration.python?.packageFile;
          if (packageFile === undefined) {
            return;
          }
          const fileUri = Uri.joinPath(this.root.uri, packageFile);
          await commands.executeCommand("vscode.open", fileUri);
        },
        this,
      ),
      commands.registerCommand(
        Commands.PythonPackages.Refresh,
        this._onRefreshPythonPackages,
        this,
      ),
      commands.registerCommand(
        Commands.PythonPackages.Scan,
        this._onScanForPythonPackageRequirements,
        this,
      ),
      commands.registerCommand(
        Commands.RPackages.Edit,
        async () => {
          if (this.root === undefined) {
            return;
          }
          const cfg = this._getActiveConfig();
          const packageFile = cfg?.configuration.r?.packageFile;
          if (packageFile === undefined) {
            return;
          }
          const fileUri = Uri.joinPath(this.root.uri, packageFile);
          await commands.executeCommand("vscode.open", fileUri);
        },
        this,
      ),
      commands.registerCommand(
        Commands.RPackages.Refresh,
        this._onRefreshRPackages,
        this,
      ),
      commands.registerCommand(
        Commands.RPackages.Scan,
        this._onScanForRPackageRequirements,
        this,
      ),
    );

    watchers.positDir?.onDidDelete(() => {
      this.refreshContentRecords();
      this.refreshConfigurations();
    }, this);
    watchers.publishDir?.onDidDelete(() => {
      this.refreshContentRecords();
      this.refreshConfigurations();
    }, this);
    watchers.contentRecordsDir?.onDidDelete(this.refreshContentRecords, this);

    watchers.configurations?.onDidCreate(this.refreshConfigurations, this);
    watchers.configurations?.onDidDelete(this.refreshConfigurations, this);
    watchers.configurations?.onDidChange(this.refreshConfigurations, this);

    watchers.contentRecords?.onDidCreate(this.refreshContentRecords, this);
    watchers.contentRecords?.onDidDelete(this.refreshContentRecords, this);
    watchers.contentRecords?.onDidChange(this.refreshContentRecords, this);

    watchers.allFiles?.onDidCreate(this.sendRefreshedFilesLists, this);
    watchers.allFiles?.onDidDelete(this.sendRefreshedFilesLists, this);
  }
}
