// Copyright (C) 2024 by Posit Software, PBC.

import path from "path";
import debounce from "debounce";

import {
  Disposable,
  ExtensionContext,
  ThemeIcon,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WorkspaceFolder,
  commands,
  env,
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
  AllContentRecordTypes,
} from "src/api";
import { useBus } from "src/bus";
import { EventStream } from "src/events";
import { getPythonInterpreterPath } from "../utils/config";
import { getSummaryStringFromError } from "src/utils/errors";
import { getNonce } from "src/utils/getNonce";
import { getUri } from "src/utils/getUri";
import { deployProject } from "src/views/deployProgress";
import { WebviewConduit } from "src/utils/webviewConduit";
import { fileExists, relativeDir, isRelativePathRoot } from "src/utils/files";
import { newDeployment } from "src/multiStepInputs/newDeployment";
import { Utils as uriUtils } from "vscode-uri";
import type {
  DeploymentSelectionResult,
  DeploymentSelector,
  HomeViewState,
  PublishProcessParams,
} from "src/types/shared";
import {
  DeployMsg,
  EditConfigurationMsg,
  NavigateMsg,
  SaveSelectionStatedMsg,
  WebviewToHostMessage,
  WebviewToHostMessageType,
  VSCodeOpenRelativeMsg,
  VSCodeOpenMsg,
} from "src/types/messages/webviewToHostMessages";
import { HostToWebviewMessageType } from "src/types/messages/hostToWebviewMessages";
import { confirmOverwrite } from "src/dialogs";
import { splitFilesOnInclusion } from "src/utils/files";
import { DeploymentQuickPick } from "src/types/quickPicks";
import { normalizeURL } from "src/utils/url";
import { selectNewOrExistingConfig } from "src/multiStepInputs/selectNewOrExistingConfig";
import { RPackage, RVersionConfig } from "src/api/types/packages";
import { calculateTitle } from "src/utils/titles";
import { ConfigWatcherManager, WatcherManager } from "src/watchers";
import { Commands, Contexts, LocalState, Views } from "src/constants";
import { showProgress } from "src/utils/progress";

enum HomeViewInitialized {
  initialized = "initialized",
  uninitialized = "uninitialized",
}

const fileEventDebounce = 200;

export class HomeViewProvider implements WebviewViewProvider, Disposable {
  private disposables: Disposable[] = [];
  private contentRecords: (
    | ContentRecord
    | PreContentRecord
    | PreContentRecordWithConfig
  )[] = [];

  private credentials: Credential[] = [];
  private configs: Configuration[] = [];
  private configsInError: ConfigurationError[] = [];
  private root: WorkspaceFolder | undefined;
  private webviewView?: WebviewView;
  private extensionUri: Uri;
  private webviewConduit: WebviewConduit;
  private initCompleteResolver: (() => void) | undefined = undefined;

  // Promise that methods can wait on, which will be resolved when
  // the initial queries finish. Then they can use our internal collections of
  // contentRecords, credentials and configs within this class
  private initComplete: Promise<void> = new Promise((resolve) => {
    this.initCompleteResolver = resolve;
  });

  private configWatchers: ConfigWatcherManager | undefined;

  constructor(
    private readonly context: ExtensionContext,
    private readonly stream: EventStream,
  ) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
    this.extensionUri = this.context.extensionUri;
    this.webviewConduit = new WebviewConduit();

    // if someone needs a refresh of any active params,
    // we are here to service that request!
    useBus().on("refreshCredentials", async () => {
      await this.refreshCredentialData();
      this.updateWebViewViewCredentials();
    });
    useBus().on("requestActiveConfig", () => {
      useBus().trigger("activeConfigChanged", this.getActiveConfig());
    });
    useBus().on("requestActiveContentRecord", () => {
      useBus().trigger(
        "activeContentRecordChanged",
        this.getActiveContentRecord(),
      );
    });

    useBus().on("activeConfigChanged", (cfg: Configuration | undefined) => {
      this.sendRefreshedFilesLists();
      this.onRefreshPythonPackages();
      this.onRefreshRPackages();

      this.configWatchers?.dispose();
      this.configWatchers = new ConfigWatcherManager(cfg);

      this.configWatchers.configFile?.onDidChange(
        this.sendRefreshedFilesLists,
        this,
      );

      this.configWatchers.pythonPackageFile?.onDidCreate(
        this.onRefreshPythonPackages,
        this,
      );
      this.configWatchers.pythonPackageFile?.onDidChange(
        this.onRefreshPythonPackages,
        this,
      );
      this.configWatchers.pythonPackageFile?.onDidDelete(
        this.onRefreshPythonPackages,
        this,
      );

      this.configWatchers.rPackageFile?.onDidCreate(
        this.onRefreshRPackages,
        this,
      );
      this.configWatchers.rPackageFile?.onDidChange(
        this.onRefreshRPackages,
        this,
      );
      this.configWatchers.rPackageFile?.onDidDelete(
        this.onRefreshRPackages,
        this,
      );
    });
  }
  /**
   * Dispatch messages passed from the webview to the handling code
   */
  private async onConduitMessage(msg: WebviewToHostMessage) {
    switch (msg.kind) {
      case WebviewToHostMessageType.DEPLOY:
        return await this.onDeployMsg(msg);
      case WebviewToHostMessageType.INITIALIZING:
        return await this.onInitializingMsg();
      case WebviewToHostMessageType.EDIT_CONFIGURATION:
        return await this.onEditConfigurationMsg(msg);
      case WebviewToHostMessageType.SHOW_SELECT_CONFIGURATION:
        return await this.showSelectOrCreateConfigForDeployment();
      case WebviewToHostMessageType.NAVIGATE:
        return await this.onNavigateMsg(msg);
      case WebviewToHostMessageType.SAVE_SELECTION_STATE:
        return await this.onSaveSelectionState(msg);
      case WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES:
        return await this.onRefreshPythonPackages();
      case WebviewToHostMessageType.REFRESH_R_PACKAGES:
        return await this.onRefreshRPackages();
      case WebviewToHostMessageType.VSCODE_OPEN_RELATIVE:
        return await this.onRelativeOpenVSCode(msg);
      case WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS:
        return await this.onScanForPythonPackageRequirements();
      case WebviewToHostMessageType.SCAN_R_PACKAGE_REQUIREMENTS:
        return await this.onScanForRPackageRequirements();
      case WebviewToHostMessageType.VSCODE_OPEN:
        return await this.onVSCodeOpen(msg);
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
      case WebviewToHostMessageType.VIEW_PUBLISHING_LOG:
        return this.showPublishingLog();
      default:
        throw new Error(
          `Error: onConduitMessage unhandled msg: ${JSON.stringify(msg)}`,
        );
    }
  }

  private async onVSCodeOpen(msg: VSCodeOpenMsg) {
    return await commands.executeCommand(
      "vscode.open",
      Uri.parse(msg.content.uri),
    );
  }

  private async onDeployMsg(msg: DeployMsg) {
    try {
      const api = await useApi();
      const response = await api.contentRecords.publish(
        msg.content.deploymentName,
        msg.content.credentialName,
        msg.content.configurationName,
        msg.content.projectDir,
      );
      deployProject(response.data.localId, this.stream);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("homeView, deploy", error);
      window.showInformationMessage(`Failed to deploy . ${summary}`);
    }
  }

  private async onInitializingMsg() {
    // send back the data needed.
    await this.refreshAll(true);
    this.setInitializationContext(HomeViewInitialized.initialized);

    // On first run, we have no saved state. Trigger a save
    // so we have the state, and can notify dependent views.
    this.requestWebviewSaveSelection();

    // Signal the webapp that we believe the initialization refreshes
    // are finished.
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.INITIALIZING_REQUEST_COMPLETE,
    });

    // signal our initialization has completed
    if (this.initCompleteResolver) {
      this.initCompleteResolver();
    }
  }

  private setInitializationContext(context: HomeViewInitialized) {
    commands.executeCommand(
      "setContext",
      Contexts.HomeView.Initialized,
      context,
    );
  }

  private async onEditConfigurationMsg(msg: EditConfigurationMsg) {
    await commands.executeCommand(
      "vscode.open",
      Uri.file(msg.content.configurationPath),
    );
  }

  private async onNavigateMsg(msg: NavigateMsg) {
    await env.openExternal(Uri.parse(msg.content.uriPath));
  }

  private async onSaveSelectionState(msg: SaveSelectionStatedMsg) {
    await this.saveSelectionState(msg.content.state);
  }

  private async updateFileList(uri: string, action: FileAction) {
    const activeConfig = this.getActiveConfig();
    if (activeConfig === undefined) {
      console.error("homeView::updateFileList: No active configuration.");
      return;
    }
    try {
      const api = await useApi();
      const apiRequest = api.files.updateFileList(
        activeConfig.configurationName,
        uri,
        action,
        activeConfig.projectDir,
      );
      showProgress("Updating File List", apiRequest, Views.HomeView);

      await apiRequest;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::updateFileList",
        error,
      );
      window.showErrorMessage(`Failed to update config file. ${summary}`);
      return;
    }
  }

  private onPublishStart() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.PUBLISH_START,
    });
  }

  private onPublishSuccess() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS,
    });
  }

  private onPublishFailure(msg: EventStreamMessage) {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.PUBLISH_FINISH_FAILURE,
      content: {
        data: {
          message: msg.data.message,
        },
      },
    });
  }

  private async refreshContentRecordData() {
    try {
      // API Returns:
      // 200 - success
      // 500 - internal server error
      const api = await useApi();
      const apiRequest = api.contentRecords.getAll(".", {
        recursive: true,
      });
      showProgress("Refreshing Deployments", apiRequest, Views.HomeView);

      const response = await apiRequest;
      const contentRecords = response.data;
      this.contentRecords = [];
      contentRecords.forEach((contentRecord) => {
        if (!isContentRecordError(contentRecord)) {
          this.contentRecords.push(contentRecord);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "refreshContentRecordData::contentRecords.getAll",
        error,
      );
      window.showInformationMessage(summary);
      throw error;
    }
  }

  private async refreshConfigurationData() {
    try {
      const api = await useApi();
      const apiRequest = api.configurations.getAll(".", {
        recursive: true,
      });
      showProgress("Refreshing Configurations", apiRequest, Views.HomeView);

      const response = await apiRequest;
      const configurations = response.data;
      this.configs = [];
      this.configsInError = [];
      configurations.forEach((config) => {
        if (!isConfigurationError(config)) {
          this.configs.push(config);
        } else {
          this.configsInError.push(config);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "refreshConfigurationData::configurations.getAll",
        error,
      );
      window.showInformationMessage(summary);
      throw error;
    }
  }

  private async refreshCredentialData() {
    try {
      const api = await useApi();
      const apiRequest = api.credentials.list();
      showProgress("Refreshing Credentials", apiRequest, Views.HomeView);

      const response = await apiRequest;
      this.credentials = response.data;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "refreshCredentialData::credentials.list",
        error,
      );
      window.showInformationMessage(summary);
      throw error;
    }
  }

  private updateWebViewViewContentRecords(
    deploymentSelector?: DeploymentSelector | null,
  ) {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CONTENTRECORD_DATA,
      content: {
        contentRecords: this.contentRecords,
        deploymentSelected: deploymentSelector,
      },
    });
  }

  private updateWebViewViewConfigurations() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CONFIG_DATA,
      content: {
        configurations: this.configs,
        configurationsInError: this.configsInError,
      },
    });
  }

  private updateWebViewViewCredentials() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA,
      content: {
        credentials: this.credentials,
      },
    });
  }

  private requestWebviewSaveSelection() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.SAVE_SELECTION,
    });
  }

  private getSelectionState(): HomeViewState {
    const state = this.context.workspaceState.get<DeploymentSelector | null>(
      LocalState.LastSelectionState,
      null,
    );
    return state;
  }

  private getActiveConfig(): Configuration | undefined {
    const savedState = this.getSelectionState();
    if (!savedState) {
      return undefined;
    }
    return this.getConfigBySelector(savedState);
  }

  private getActiveContentRecord():
    | ContentRecord
    | PreContentRecord
    | undefined {
    const savedState = this.getSelectionState();
    if (!savedState) {
      return undefined;
    }
    return this.getContentRecordBySelector(savedState);
  }

  private getContentRecordBySelector(selector: DeploymentSelector) {
    return this.contentRecords.find(
      (d) => d.deploymentPath === selector.deploymentPath,
    );
  }

  private getConfigBySelector(selector: DeploymentSelector) {
    const deployment = this.getContentRecordBySelector(selector);
    if (deployment) {
      return this.configs.find(
        (c) =>
          c.configurationName === deployment.configurationName &&
          c.projectDir === deployment.projectDir,
      );
    }
    return undefined;
  }

  private async saveSelectionState(state: HomeViewState): Promise<void> {
    await this.context.workspaceState.update(
      LocalState.LastSelectionState,
      state,
    );

    useBus().trigger(
      "activeContentRecordChanged",
      this.getActiveContentRecord(),
    );
    useBus().trigger("activeConfigChanged", this.getActiveConfig());
  }

  private async onRefreshPythonPackages() {
    const activeConfiguration = this.getActiveConfig();
    let pythonProject = true;
    let packages: string[] = [];
    let packageFile: string | undefined;
    let packageMgr: string | undefined;

    const api = await useApi();

    if (activeConfiguration) {
      const pythonSection = activeConfiguration?.configuration.python;
      if (!pythonSection) {
        pythonProject = false;
      } else {
        try {
          packageFile = pythonSection.packageFile;
          packageMgr = pythonSection.packageManager;

          const apiRequest = api.packages.getPythonPackages(
            activeConfiguration.configurationName,
            activeConfiguration.projectDir,
          );
          showProgress(
            "Refreshing Python Packages",
            apiRequest,
            Views.HomeView,
          );

          const response = await apiRequest;
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
              "homeView::onRefreshPythonPackages",
              error,
            );
            window.showInformationMessage(summary);
            return;
          }
        }
      }
    }
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES,
      content: {
        pythonProject,
        file: packageFile,
        manager: packageMgr,
        packages,
      },
    });
  }

  private async onRefreshRPackages() {
    const activeConfiguration = this.getActiveConfig();
    let rProject = true;
    let packages: RPackage[] = [];
    let packageFile: string | undefined;
    let packageMgr: string | undefined;
    let rVersionConfig: RVersionConfig | undefined;

    const api = await useApi();

    if (activeConfiguration) {
      const rSection = activeConfiguration?.configuration.r;
      if (!rSection) {
        rProject = false;
      } else {
        try {
          packageFile = rSection.packageFile;
          packageMgr = rSection.packageManager;

          const apiRequest = api.packages.getRPackages(
            activeConfiguration.configurationName,
            activeConfiguration.projectDir,
          );
          showProgress("Refreshing R Packages", apiRequest, Views.HomeView);

          const response = await apiRequest;
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
              "homeView::onRefreshRPackages",
              error,
            );
            window.showInformationMessage(summary);
            return;
          }
        }
      }
    }
    this.webviewConduit.sendMsg({
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

  private async onRelativeOpenVSCode(msg: VSCodeOpenRelativeMsg) {
    if (this.root === undefined) {
      return;
    }
    const activeContentRecord = this.getActiveContentRecord();
    if (!activeContentRecord) {
      return;
    }

    const fileUri = Uri.joinPath(
      this.root.uri,
      activeContentRecord.projectDir,
      msg.content.relativePath,
    );
    await commands.executeCommand("vscode.open", fileUri);
  }

  private async onScanForPythonPackageRequirements() {
    if (this.root === undefined) {
      // We shouldn't get here if there's no workspace folder open.
      return;
    }
    const activeConfiguration = this.getActiveConfig();
    if (activeConfiguration === undefined) {
      // Cannot scan if there is no active configuration.
      return;
    }

    const relPathPackageFile =
      activeConfiguration?.configuration.python?.packageFile;
    if (relPathPackageFile === undefined) {
      return;
    }

    const fileUri = Uri.joinPath(
      this.root.uri,
      activeConfiguration.projectDir,
      relPathPackageFile,
    );

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
      const apiRequest = api.packages.createPythonRequirementsFile(
        activeConfiguration.projectDir,
        python,
        relPathPackageFile,
      );
      showProgress(
        "Refreshing Python Requirements File",
        apiRequest,
        Views.HomeView,
      );

      await apiRequest;
      await commands.executeCommand("vscode.open", fileUri);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::onScanForPythonPackageRequirements",
        error,
      );
      window.showInformationMessage(summary);
    }
  }

  private async onScanForRPackageRequirements() {
    if (this.root === undefined) {
      // We shouldn't get here if there's no workspace folder open.
      return;
    }
    const activeConfiguration = this.getActiveConfig();
    if (activeConfiguration === undefined) {
      // Cannot scan if there is no active configuration.
      return;
    }

    const relPathPackageFile =
      activeConfiguration?.configuration.r?.packageFile;
    if (relPathPackageFile === undefined) {
      return;
    }

    const fileUri = Uri.joinPath(
      this.root.uri,
      activeConfiguration.projectDir,
      relPathPackageFile,
    );

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
      const apiRequest = api.packages.createRRequirementsFile(
        activeConfiguration.projectDir,
        relPathPackageFile,
      );
      showProgress("Creating R Requirements File", apiRequest, Views.HomeView);

      await apiRequest;
      await commands.executeCommand("vscode.open", fileUri);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::onScanForRPackageRequirements",
        error,
      );
      window.showInformationMessage(summary);
    }
  }

  private async propagateDeploymentSelection(
    deploymentSelector: DeploymentSelector | null,
  ) {
    // We have to break our protocol and go ahead and write this into storage,
    // in case this multi-stepper is actually running ahead of the webview
    // being brought up.
    this.saveSelectionState(deploymentSelector);
    // Now push down into the webview
    this.updateWebViewViewCredentials();
    this.updateWebViewViewConfigurations();
    this.updateWebViewViewContentRecords(deploymentSelector);
    // And have the webview save what it has selected.
    this.requestWebviewSaveSelection();
  }

  private getCredentialForContentRecord(
    contentRecord: ContentRecord | PreContentRecord,
  ): Credential | undefined {
    const credential = this.credentials.find(
      (credential) =>
        normalizeURL(credential.url).toLowerCase() ===
        normalizeURL(contentRecord.serverUrl).toLowerCase(),
    );
    return credential;
  }

  private async showSelectOrCreateConfigForDeployment(): Promise<
    DeploymentSelectionResult | undefined
  > {
    const targetContentRecord = this.getActiveContentRecord();
    if (targetContentRecord === undefined) {
      console.error(
        "homeView::showSelectConfigForDeployment: No target deployment.",
      );
      return undefined;
    }

    const config = await selectNewOrExistingConfig(
      targetContentRecord,
      Views.HomeView,
      this.getActiveConfig(),
    );
    if (config) {
      const api = await useApi();
      const apiRequest = api.contentRecords.patch(
        targetContentRecord.deploymentName,
        config.configurationName,
        targetContentRecord.projectDir,
      );
      showProgress("Updating Config", apiRequest, Views.HomeView);

      await apiRequest;

      // now select the new, updated or existing deployment
      const deploymentSelector: DeploymentSelector = {
        deploymentPath: targetContentRecord.deploymentPath,
      };
      this.propagateDeploymentSelection(deploymentSelector);

      const credential =
        this.getCredentialForContentRecord(targetContentRecord);

      if (
        !targetContentRecord.deploymentName ||
        !credential ||
        !config.configurationName ||
        !targetContentRecord.projectDir
      ) {
        // display an error.
        return undefined;
      }
      return {
        selector: deploymentSelector,
        publishParams: {
          deploymentName: targetContentRecord.deploymentName,
          credentialName: credential.name,
          configurationName: config.configurationName,
          projectDir: targetContentRecord.projectDir,
        },
      };
    }
    return undefined;
  }

  public async showNewDeploymentMultiStep(
    viewId: string,
    projectDir?: string,
    entryPoint?: string,
  ): Promise<DeploymentSelectionResult | undefined> {
    // We need the initial queries to finish, before we can
    // use them (contentRecords, credentials and configs)
    await this.initComplete;

    const deploymentObjects = await newDeployment(
      viewId,
      projectDir,
      entryPoint,
    );
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
        !this.contentRecords.find(
          (contentRecord) =>
            contentRecord.saveName ===
              deploymentObjects.contentRecord.saveName &&
            contentRecord.projectDir ===
              deploymentObjects.contentRecord.projectDir,
        )
      ) {
        this.contentRecords.push(deploymentObjects.contentRecord);
      }
      if (
        !this.configs.find(
          (config) =>
            config.configurationName ===
              deploymentObjects.configuration.configurationName &&
            config.projectDir === deploymentObjects.configuration.projectDir,
        )
      ) {
        this.configs.push(deploymentObjects.configuration);
      }
      if (
        !this.credentials.find(
          (credential) => credential.name === deploymentObjects.credential.name,
        )
      ) {
        this.credentials.push(deploymentObjects.credential);
        refreshCredentials = true;
      }
      const deploymentSelector: DeploymentSelector = {
        deploymentPath: deploymentObjects.contentRecord.deploymentPath,
      };

      this.propagateDeploymentSelection(deploymentSelector);
      // Credentials aren't auto-refreshed, so we have to trigger it ourselves.
      if (refreshCredentials) {
        useBus().trigger("refreshCredentials", undefined);
      }
      return {
        selector: deploymentSelector,
        publishParams: {
          deploymentName: deploymentObjects.contentRecord.deploymentName,
          credentialName: deploymentObjects.credential.name,
          configurationName: deploymentObjects.configuration.configurationName,
          projectDir: deploymentObjects.contentRecord.projectDir,
        },
      };
    }
    return undefined;
  }

  private showNewCredential() {
    const contentRecord = this.getActiveContentRecord();

    return commands.executeCommand(
      Commands.Credentials.Add,
      contentRecord?.serverUrl,
    );
  }

  private showPublishingLog() {
    return commands.executeCommand(Commands.Logs.Focus);
  }

  private async showDeploymentQuickPick(
    contentRecordsSubset?: AllContentRecordTypes[],
    projectDir?: string,
  ): Promise<DeploymentSelectionResult | undefined> {
    // We need the initial queries to finish, before we can
    // use them (contentRecords, credentials and configs)
    await this.initComplete;

    // Create quick pick list from current contentRecords, credentials and configs
    const deployments: DeploymentQuickPick[] = [];
    const lastContentRecordName = this.getActiveContentRecord()?.saveName;
    const lastContentRecordProjectDir = projectDir
      ? projectDir
      : this.getActiveContentRecord()?.projectDir;
    const lastConfigName = this.getActiveConfig()?.configurationName;

    const includedContentRecords = contentRecordsSubset
      ? contentRecordsSubset
      : this.contentRecords;

    includedContentRecords.forEach((contentRecord) => {
      if (
        isContentRecordError(contentRecord) ||
        (isPreContentRecord(contentRecord) &&
          !isPreContentRecordWithConfig(contentRecord))
      ) {
        // we won't include these for now. Perhaps in the future, we can show them
        // as disabled.
        return;
      }

      let config: Configuration | ConfigurationError | undefined;
      if (contentRecord.configurationName) {
        config = this.configs.find(
          (config) =>
            config.configurationName === contentRecord.configurationName &&
            config.projectDir === contentRecord.projectDir,
        );
        if (!config) {
          config = this.configsInError.find(
            (config) =>
              config.configurationName === contentRecord.configurationName &&
              config.projectDir === contentRecord.projectDir,
          );
        }
      }

      let credential = this.credentials.find(
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

      let details = [];
      if (!isRelativePathRoot(contentRecord.projectDir)) {
        details.push(`${contentRecord.projectDir}${path.sep}`);
      }
      if (credential?.name) {
        details.push(credential.name);
      } else {
        details.push(`Missing Credential for ${contentRecord.serverUrl}`);
        problem = true;
      }
      const detail = details.join(" • ");

      let lastMatch =
        lastContentRecordName === contentRecord.saveName &&
        lastContentRecordProjectDir === contentRecord.projectDir &&
        lastConfigName === configName;

      const deployment: DeploymentQuickPick = {
        label: title,
        detail,
        iconPath: problem
          ? new ThemeIcon("error")
          : new ThemeIcon("cloud-upload"),
        contentRecord,
        config,
        credentialName: credential?.name,
        lastMatch,
      };
      // Should we not push deployments with no config or matching credentials?
      deployments.push(deployment);
    });

    const toDispose: Disposable[] = [];
    const deployment = await new Promise<DeploymentQuickPick | undefined>(
      (resolve) => {
        const quickPick = window.createQuickPick<DeploymentQuickPick>();
        this.disposables.push(quickPick);

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

    let deploymentSelector: DeploymentSelector | undefined;
    if (deployment) {
      deploymentSelector = {
        deploymentPath: deployment.contentRecord.deploymentPath,
      };
      this.updateWebViewViewCredentials();
      this.updateWebViewViewConfigurations();
      this.updateWebViewViewContentRecords(deploymentSelector);
      this.requestWebviewSaveSelection();
    }

    if (
      !deploymentSelector ||
      !deployment ||
      !deployment.detail ||
      !deployment.credentialName
    ) {
      return;
    }
    return {
      selector: deploymentSelector,
      publishParams: {
        deploymentName: deployment.contentRecord.deploymentName,
        credentialName: deployment.credentialName,
        configurationName: deployment.contentRecord.configurationName,
        projectDir: deployment.contentRecord.projectDir,
      },
    };
  }

  public resolveWebviewView(webviewView: WebviewView) {
    this.webviewView = webviewView;
    this.webviewConduit.init(this.webviewView.webview);

    // Allow scripts in the webview
    webviewView.webview.options = {
      // Enable JavaScript in the webview
      enableScripts: true,
      // Restrict the webview to only load resources from these directories
      localResourceRoots: [
        Uri.joinPath(this.extensionUri, "webviews", "homeView", "dist"),
        Uri.joinPath(
          this.extensionUri,
          "node_modules",
          "@vscode",
          "codicons",
          "dist",
        ),
      ],
    };

    // Set the HTML content that will fill the webview view
    webviewView.webview.html = this.getWebviewContent(
      webviewView.webview,
      this.extensionUri,
    );

    // Sets up an event listener to listen for messages passed from the webview view this.context
    // and executes code based on the message that is recieved
    this.disposables.push(
      this.webviewConduit.onMsg(this.onConduitMessage.bind(this)),
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
  private getWebviewContent(webview: Webview, extensionUri: Uri) {
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
        this.refreshContentRecordData(),
        this.refreshConfigurationData(),
        this.refreshCredentialData(),
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
      ? this.getSelectionState()
      : undefined;
    this.updateWebViewViewCredentials();
    this.updateWebViewViewConfigurations();
    this.updateWebViewViewContentRecords(selectionState || null);
    if (includeSavedState && selectionState) {
      useBus().trigger(
        "activeContentRecordChanged",
        this.getActiveContentRecord(),
      );
      useBus().trigger("activeConfigChanged", this.getActiveConfig());
    }
  };

  public refreshContentRecords = async () => {
    await this.refreshContentRecordData();
    this.updateWebViewViewContentRecords();
    useBus().trigger(
      "activeContentRecordChanged",
      this.getActiveContentRecord(),
    );
  };

  public refreshConfigurations = async () => {
    await this.refreshConfigurationData();
    this.updateWebViewViewConfigurations();
    useBus().trigger("activeConfigChanged", this.getActiveConfig());
  };

  public sendRefreshedFilesLists = async () => {
    const api = await useApi();
    const activeConfig = this.getActiveConfig();
    if (activeConfig) {
      try {
        const apiRequest = api.files.getByConfiguration(
          activeConfig.configurationName,
          activeConfig.projectDir,
        );
        showProgress("ReFreshing Files", apiRequest, Views.HomeView);

        const response = await apiRequest;

        this.webviewConduit.sendMsg({
          kind: HostToWebviewMessageType.REFRESH_FILES_LISTS,
          content: {
            ...splitFilesOnInclusion(response.data),
          },
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "sendRefreshedFilesLists, files.getByConfiguration",
          error,
        );
        window.showErrorMessage(`Failed to refresh files. ${summary}`);
        return;
      }
    }
  };

  public initiatePublish(target: PublishProcessParams) {
    this.onDeployMsg({
      kind: WebviewToHostMessageType.DEPLOY,
      content: target,
    });
  }

  public async handleFileInitiatedDeployment(uri: Uri) {
    // Guide the user to create a new Deployment with that file as the entrypoint
    // if one doesn’t exist
    // Select the Deployment with an active configuration for that entrypoint if there
    // is only one
    // With multiple, if a compatible one is already active, then do nothing.
    // Otherwise, prompt for selection between multiple compatible deployments

    const dir = relativeDir(uri);
    // If the file is outside the workspace, it cannot be an entrypoint
    if (dir === undefined) {
      return false;
    }
    const entrypoint = uriUtils.basename(uri);

    const api = await useApi();

    // We need the initial queries to finish, before we can
    // use them (contentRecords, credentials and configs)
    await this.initComplete;

    // get all of the deployments for projectDir
    // get the configs which are filtered for the entrypoint in that projectDir
    // determine a list of deployments that use those filtered configs

    let contentRecordList: (ContentRecord | PreContentRecord)[] = [];
    const getContentRecords = new Promise<void>(async (resolve, reject) => {
      try {
        const response = await api.contentRecords.getAll(dir, {
          recursive: false,
        });
        response.data.forEach((c) => {
          if (!isContentRecordError(c)) {
            contentRecordList.push(c);
          }
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "handleFileInitiatedDeployment, contentRecords.getAll",
          error,
        );
        window.showInformationMessage(
          `Unable to continue due to deployment error. ${summary}`,
        );
        return reject();
      }
      return resolve();
    });

    let configMap = new Map<string, Configuration>();
    const getConfigurations = new Promise<void>(async (resolve, reject) => {
      try {
        const response = await api.configurations.getAll(dir, {
          entrypoint,
          recursive: false,
        });
        let rawConfigs = response.data;
        rawConfigs.forEach((c) => {
          if (!isConfigurationError(c)) {
            configMap.set(c.configurationName, c);
          }
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "handleFileInitiatedDeployment, configurations.getAll",
          error,
        );
        window.showErrorMessage(
          `Unable to continue with API Error: ${summary}`,
        );
        return reject();
      }
      resolve();
    });

    const apisComplete = Promise.all([getContentRecords, getConfigurations]);

    showProgress(
      "Initializing::handleFileInitiatedDeployment",
      apisComplete,
      Views.HomeView,
    );

    try {
      await apisComplete;
    } catch {
      // errors have already been displayed by the underlying promises..
      return undefined;
    }

    // Build up a list of compatible content records with this entrypoint
    // Unable to do this within the API because pre-deployments do not have
    // their entrypoint recorded.
    const compatibleContentRecords: (ContentRecord | PreContentRecord)[] = [];
    contentRecordList.forEach((c) => {
      if (configMap.get(c.configurationName)) {
        compatibleContentRecords.push(c);
      }
    });

    // if no deployments, create one
    if (!compatibleContentRecords.length) {
      // call new deployment
      const selected = await this.showNewDeploymentMultiStep(
        Views.HomeView,
        dir,
        entrypoint,
      );
      if (selected) {
        // publish!
        return this.initiatePublish(selected.publishParams);
      }
      return false;
    }
    // only one deployment, just publish it
    if (compatibleContentRecords.length === 1) {
      const contentRecord = compatibleContentRecords[0];
      const deploymentSelector: DeploymentSelector = {
        deploymentPath: contentRecord.deploymentPath,
      };
      await this.propagateDeploymentSelection(deploymentSelector);
      const credential = this.getCredentialForContentRecord(contentRecord);
      if (!credential) {
        window.showErrorMessage(
          `Error: Unable to Deploy. No credential found for server at ${contentRecord.serverUrl}`,
        );
        return;
      }

      const target: PublishProcessParams = {
        deploymentName: contentRecord.saveName,
        credentialName: credential.name,
        configurationName: contentRecord.configurationName,
        projectDir: contentRecord.projectDir,
      };
      // publish!
      return this.initiatePublish(target);
    }
    // if there are multiple compatible deployments, then make sure one of these isn't
    // already selected. If it is, do nothing, otherwise pick between the compatible ones.
    const currentContentRecord = this.getActiveContentRecord();
    if (
      !currentContentRecord ||
      !compatibleContentRecords.find((c) => {
        return c.deploymentPath === currentContentRecord?.deploymentPath;
      })
    ) {
      // none of the compatible ones are selected
      const selected = await this.showDeploymentQuickPick(
        compatibleContentRecords,
        dir,
      );
      if (selected) {
        // publish!
        return this.initiatePublish(selected.publishParams);
      }
      return false;
    }
    // compatible content record already active. Publish
    const credential = this.getCredentialForContentRecord(currentContentRecord);
    if (!credential) {
      window.showErrorMessage(
        `Error: Unable to Deploy. No credential found for server at ${currentContentRecord.serverUrl}`,
      );
      return;
    }
    const target: PublishProcessParams = {
      deploymentName: currentContentRecord.saveName,
      credentialName: credential.name,
      configurationName: currentContentRecord.configurationName,
      projectDir: currentContentRecord.projectDir,
    };
    return this.initiatePublish(target);
  }

  /**
   * Cleans up and disposes of webview resources when view is disposed
   */
  public dispose() {
    Disposable.from(...this.disposables).dispose();

    this.configWatchers?.dispose();
  }

  public register(watchers: WatcherManager) {
    this.stream.register("publish/start", () => {
      this.onPublishStart();
    });
    this.stream.register("publish/success", () => {
      this.onPublishSuccess();
    });
    this.stream.register("publish/failure", (msg: EventStreamMessage) => {
      this.onPublishFailure(msg);
    });

    this.context.subscriptions.push(
      window.registerWebviewViewProvider(Views.HomeView, this, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }),
    );

    this.context.subscriptions.push(
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
        Commands.HomeView.ShowSelectConfigForDeployment,
        this.showSelectOrCreateConfigForDeployment,
        this,
      ),
      commands.registerCommand(
        Commands.HomeView.CreateConfigForDeployment,
        this.showSelectOrCreateConfigForDeployment,
        this,
      ),
      commands.registerCommand(
        Commands.HomeView.NavigateToDeploymentServer,
        async () => {
          const deployment = this.getActiveContentRecord();
          if (deployment) {
            await env.openExternal(Uri.parse(deployment.serverUrl));
          }
        },
      ),
      commands.registerCommand(
        Commands.HomeView.NavigateToDeploymentContent,
        async () => {
          const contentRecord = this.getActiveContentRecord();
          if (contentRecord && !isPreContentRecord(contentRecord)) {
            await env.openExternal(Uri.parse(contentRecord.dashboardUrl));
          }
        },
      ),
      commands.registerCommand(Commands.HomeView.ShowContentLogs, async () => {
        const contentRecord = this.getActiveContentRecord();
        if (contentRecord && !isPreContentRecord(contentRecord)) {
          const logUrl = `${contentRecord.dashboardUrl}/logs`;
          await env.openExternal(Uri.parse(logUrl));
        }
      }),
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
          const cfg = this.getActiveConfig();
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
        this.onRefreshPythonPackages,
        this,
      ),
      commands.registerCommand(
        Commands.PythonPackages.Scan,
        this.onScanForPythonPackageRequirements,
        this,
      ),
      commands.registerCommand(
        Commands.RPackages.Edit,
        async () => {
          if (this.root === undefined) {
            return;
          }
          const cfg = this.getActiveConfig();
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
        this.onRefreshRPackages,
        this,
      ),
      commands.registerCommand(
        Commands.RPackages.Scan,
        this.onScanForRPackageRequirements,
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

    const fileEventCallback = debounce(
      this.sendRefreshedFilesLists,
      fileEventDebounce,
    );
    watchers.allFiles?.onDidCreate(fileEventCallback, this);
    watchers.allFiles?.onDidDelete(fileEventCallback, this);
  }
}
