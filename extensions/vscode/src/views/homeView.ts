// Copyright (C) 2024 by Posit Software, PBC.

import path from "path";
import debounce from "debounce";

import {
  Disposable,
  ExtensionContext,
  QuickPickItem,
  QuickPickItemKind,
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
import { Mutex } from "async-mutex";

import {
  Configuration,
  ConfigurationError,
  ContentRecord,
  EventStreamMessage,
  FileAction,
  PreContentRecord,
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
import { Utils as uriUtils } from "vscode-uri";
import { newDeployment } from "src/multiStepInputs/newDeployment";
import type {
  DeploymentSelector,
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
import { confirmDelete, confirmOverwrite } from "src/dialogs";
import { DeploymentQuickPick } from "src/types/quickPicks";
import { selectNewOrExistingConfig } from "src/multiStepInputs/selectNewOrExistingConfig";
import { RPackage, RVersionConfig } from "src/api/types/packages";
import { calculateTitle } from "src/utils/titles";
import { ConfigWatcherManager, WatcherManager } from "src/watchers";
import { Commands, Contexts, DebounceDelaysMS, Views } from "src/constants";
import { showProgress } from "src/utils/progress";
import { newCredential } from "src/multiStepInputs/newCredential";
import { PublisherState } from "src/state";
import { throttleWithLastPending } from "src/utils/throttle";

enum HomeViewInitialized {
  initialized = "initialized",
  uninitialized = "uninitialized",
}

export class HomeViewProvider implements WebviewViewProvider, Disposable {
  private disposables: Disposable[] = [];

  private state: PublisherState;

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

    this.state = new PublisherState(this.context);

    this.extensionUri = this.context.extensionUri;
    this.webviewConduit = new WebviewConduit();

    // if someone needs a refresh of any active params,
    // we are here to service that request!
    useBus().on("refreshCredentials", async () => {
      await this.refreshCredentialData();
      this.updateWebViewViewCredentials();
    });
    useBus().on("requestActiveConfig", async () => {
      useBus().trigger(
        "activeConfigChanged",
        await this.state.getSelectedConfiguration(),
      );
    });
    useBus().on("requestActiveContentRecord", async () => {
      useBus().trigger(
        "activeContentRecordChanged",
        await this.state.getSelectedContentRecord(),
      );
    });

    useBus().on(
      "activeConfigChanged",
      (cfg: Configuration | ConfigurationError | undefined) => {
        this.sendRefreshedFilesLists();
        this.refreshPythonPackages();
        this.refreshRPackages();

        this.configWatchers?.dispose();
        if (cfg && isConfigurationError(cfg)) {
          return;
        }
        this.configWatchers = new ConfigWatcherManager(cfg);

        this.configWatchers.configFile?.onDidChange(
          this.debounceSendRefreshedFilesLists,
          this,
        );

        this.configWatchers.pythonPackageFile?.onDidCreate(
          this.debounceRefreshPythonPackages,
          this,
        );
        this.configWatchers.pythonPackageFile?.onDidChange(
          this.debounceRefreshPythonPackages,
          this,
        );
        this.configWatchers.pythonPackageFile?.onDidDelete(
          this.debounceRefreshPythonPackages,
          this,
        );

        this.configWatchers.rPackageFile?.onDidCreate(
          this.debounceRefreshRPackages,
          this,
        );
        this.configWatchers.rPackageFile?.onDidChange(
          this.debounceRefreshRPackages,
          this,
        );
        this.configWatchers.rPackageFile?.onDidDelete(
          this.debounceRefreshRPackages,
          this,
        );
      },
    );
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
        return await this.debounceRefreshPythonPackages();
      case WebviewToHostMessageType.REFRESH_R_PACKAGES:
        return await this.debounceRefreshRPackages();
      case WebviewToHostMessageType.VSCODE_OPEN_RELATIVE:
        return await this.onRelativeOpenVSCode(msg);
      case WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS:
        return await this.onScanForPythonPackageRequirements();
      case WebviewToHostMessageType.SCAN_R_PACKAGE_REQUIREMENTS:
        return await this.onScanForRPackageRequirements();
      case WebviewToHostMessageType.VSCODE_OPEN:
        return await this.onVSCodeOpen(msg);
      case WebviewToHostMessageType.REQUEST_FILES_LISTS:
        return this.debounceSendRefreshedFilesLists();
      case WebviewToHostMessageType.REQUEST_CREDENTIALS:
        return await this.onRequestCredentials();
      case WebviewToHostMessageType.INCLUDE_FILE:
        return this.updateFileList(msg.content.path, FileAction.INCLUDE);
      case WebviewToHostMessageType.EXCLUDE_FILE:
        return this.updateFileList(msg.content.path, FileAction.EXCLUDE);
      case WebviewToHostMessageType.SELECT_DEPLOYMENT:
        return this.showDeploymentQuickPick();
      case WebviewToHostMessageType.NEW_DEPLOYMENT:
        return this.showNewDeploymentMultiStep(Views.HomeView);
      case WebviewToHostMessageType.NEW_CREDENTIAL_FOR_DEPLOYMENT:
        return this.showNewCredentialForDeployment();
      case WebviewToHostMessageType.NEW_CREDENTIAL:
        return this.showNewCredential();
      case WebviewToHostMessageType.VIEW_PUBLISHING_LOG:
        return this.showPublishingLog();
      default:
        window.showErrorMessage(
          `Internal Error: onConduitMessage unhandled msg: ${JSON.stringify(msg)}`,
        );
        return;
    }
  }

  private async onVSCodeOpen(msg: VSCodeOpenMsg) {
    return await commands.executeCommand(
      "vscode.open",
      Uri.parse(msg.content.uri),
    );
  }

  private async initiateDeployment(
    deploymentName: string,
    credentialName: string,
    configurationName: string,
    projectDir: string,
  ) {
    try {
      const api = await useApi();
      const response = await api.contentRecords.publish(
        deploymentName,
        credentialName,
        configurationName,
        projectDir,
      );
      deployProject(response.data.localId, this.stream);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("homeView, deploy", error);
      window.showInformationMessage(`Failed to deploy . ${summary}`);
    }
  }

  private onDeployMsg(msg: DeployMsg) {
    return this.initiateDeployment(
      msg.content.deploymentName,
      msg.content.credentialName,
      msg.content.configurationName,
      msg.content.projectDir,
    );
  }

  private async onInitializingMsg() {
    // inform webview of the platform specific path separator
    // (path package is a node library, wrapper for browser doesn't seem to work in webview correctly)
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.SET_PATH_SEPARATOR,
      content: {
        separator: path.sep,
      },
    });

    // send back the data needed. Optimize request for initialization...
    await this.refreshAll(false, true);
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
    const activeConfig = await this.state.getSelectedConfiguration();
    if (activeConfig === undefined) {
      console.error("homeView::updateFileList: No active configuration.");
      return;
    }
    try {
      await showProgress("Updating File List", Views.HomeView, async () => {
        const api = await useApi();
        await api.files.updateFileList(
          activeConfig.configurationName,
          `/${uri}`,
          action,
          activeConfig.projectDir,
        );
      });
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
      await showProgress(
        "Refreshing Deployments",
        Views.HomeView,
        async () => await this.state.refreshContentRecords(),
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "refreshContentRecordData::contentRecords.getAll",
        error,
      );
      window.showErrorMessage(summary);
      return;
    }
  }

  private async refreshConfigurationData() {
    try {
      await showProgress(
        "Refreshing Configurations",
        Views.HomeView,
        async () => await this.state.refreshConfigurations(),
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "Internal Error: refreshConfigurationData::configurations.getAll",
        error,
      );
      window.showErrorMessage(summary);
      return;
    }
  }

  private async onRequestCredentials() {
    await this.refreshCredentialData();
    return this.updateWebViewViewCredentials();
  }

  private async refreshCredentialData() {
    try {
      await showProgress(
        "Refreshing Credentials",
        Views.HomeView,
        async () => await this.state.refreshCredentials(),
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "Internal Error: refreshCredentialData::credentials.list",
        error,
      );
      window.showErrorMessage(summary);
      return;
    }
  }

  private updateWebViewViewContentRecords(
    deploymentSelector?: DeploymentSelector | null,
  ) {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CONTENTRECORD_DATA,
      content: {
        contentRecords: this.state.contentRecords,
        deploymentSelected: deploymentSelector,
      },
    });
  }

  private updateWebViewViewConfigurations() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CONFIG_DATA,
      content: {
        configurations: this.state.validConfigs,
        configurationsInError: this.state.configsInError,
      },
    });
  }

  private updateWebViewViewCredentials() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA,
      content: {
        credentials: this.state.credentials,
      },
    });
  }

  private requestWebviewSaveSelection() {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.SAVE_SELECTION,
    });
  }

  private async saveSelectionState(
    state: DeploymentSelector | null,
  ): Promise<void> {
    if (!state) {
      // NOTE: Didn't make these fields optional because of the burden of
      // type checking before use
      await this.state.updateSelection({
        deploymentName: "",
        deploymentPath: "",
        projectDir: "",
        version: "v1",
      });
    } else {
      await this.state.updateSelection({
        ...state,
        version: "v1",
      });
    }
    useBus().trigger(
      "activeContentRecordChanged",
      await this.state.getSelectedContentRecord(),
    );
    useBus().trigger(
      "activeConfigChanged",
      await this.state.getSelectedConfiguration(),
    );
  }

  public debounceRefreshPythonPackages = debounce(
    this.refreshPythonPackages,
    DebounceDelaysMS.refreshPythonPackages,
  );

  private async refreshPythonPackages() {
    const activeConfiguration = await this.state.getSelectedConfiguration();
    let pythonProject = true;
    let packages: string[] = [];
    let packageFile: string | undefined;
    let packageMgr: string | undefined;

    const api = await useApi();

    if (activeConfiguration && !isConfigurationError(activeConfiguration)) {
      const pythonSection = activeConfiguration.configuration.python;
      if (!pythonSection) {
        pythonProject = false;
      } else {
        try {
          packageFile = pythonSection.packageFile;
          packageMgr = pythonSection.packageManager;

          const response = await showProgress(
            "Refreshing Python Packages",
            Views.HomeView,
            async () => {
              return await api.packages.getPythonPackages(
                activeConfiguration.configurationName,
                activeConfiguration.projectDir,
              );
            },
          );

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
              "homeView::refreshPythonPackages",
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

  public debounceRefreshRPackages = debounce(
    this.refreshRPackages,
    DebounceDelaysMS.refreshRPackages,
  );

  private async refreshRPackages() {
    const activeConfiguration = await this.state.getSelectedConfiguration();
    let rProject = true;
    let packages: RPackage[] = [];
    let packageFile: string | undefined;
    let packageMgr: string | undefined;
    let rVersionConfig: RVersionConfig | undefined;

    const api = await useApi();

    if (activeConfiguration && !isConfigurationError(activeConfiguration)) {
      const rSection = activeConfiguration.configuration.r;
      if (!rSection) {
        rProject = false;
      } else {
        try {
          packageFile = rSection.packageFile;
          packageMgr = rSection.packageManager;

          const response = await showProgress(
            "Refreshing R Packages",
            Views.HomeView,
            async () =>
              await api.packages.getRPackages(
                activeConfiguration.configurationName,
                activeConfiguration.projectDir,
              ),
          );

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
              "homeView::refreshRPackages",
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
    const activeContentRecord = await this.state.getSelectedContentRecord();
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
    const activeConfiguration = await this.state.getSelectedConfiguration();
    if (
      activeConfiguration === undefined ||
      isConfigurationError(activeConfiguration)
    ) {
      // Cannot scan if there is no active configuration.
      return;
    }

    const relPathPackageFile =
      activeConfiguration.configuration.python?.packageFile;
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
      const response = await showProgress(
        "Refreshing Python Requirements File",
        Views.HomeView,
        async () => {
          const api = await useApi();
          const python = await getPythonInterpreterPath();
          return await api.packages.createPythonRequirementsFile(
            activeConfiguration.projectDir,
            python,
            relPathPackageFile,
          );
        },
      );

      const data = response.data;
      await commands.executeCommand("vscode.open", fileUri);

      if (data.incomplete.length > 0) {
        const importList = data.incomplete.join(", ");
        const msg = `Could not find installed packages for some imports using ${data.python}. Install the required packages, or select a different interpreter, and try scanning again. Imports: ${importList}`;
        window.showWarningMessage(msg);
      }
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
    const activeConfiguration = await this.state.getSelectedConfiguration();
    if (
      activeConfiguration === undefined ||
      isConfigurationError(activeConfiguration)
    ) {
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
      await showProgress(
        "Creating R Requirements File",
        Views.HomeView,
        async () => {
          const api = await useApi();
          return await api.packages.createRRequirementsFile(
            activeConfiguration.projectDir,
            relPathPackageFile,
          );
        },
      );
      await commands.executeCommand("vscode.open", fileUri);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::onScanForRPackageRequirements",
        error,
      );
      window.showInformationMessage(summary);
    }
  }

  private propagateDeploymentSelection(
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

  private async showSelectOrCreateConfigForDeployment(): Promise<
    DeploymentSelector | undefined
  > {
    const targetContentRecord = await this.state.getSelectedContentRecord();
    if (targetContentRecord === undefined) {
      console.error(
        "homeView::showSelectConfigForDeployment: No target deployment.",
      );
      return undefined;
    }
    try {
      // disable our home view, we are initiating a multi-step sequence
      this.webviewConduit.sendMsg({
        kind: HostToWebviewMessageType.SHOW_DISABLE_OVERLAY,
      });
      const config = await selectNewOrExistingConfig(
        targetContentRecord,
        Views.HomeView,
        await this.state.getSelectedConfiguration(),
      );
      if (config) {
        await showProgress("Updating Config", Views.HomeView, async () => {
          const api = await useApi();
          await api.contentRecords.patch(
            targetContentRecord.deploymentName,
            config.configurationName,
            targetContentRecord.projectDir,
          );
        });

        // now select the new, updated or existing deployment
        const deploymentSelector: DeploymentSelector = {
          deploymentPath: targetContentRecord.deploymentPath,
          deploymentName: targetContentRecord.saveName,
          projectDir: targetContentRecord.projectDir,
        };
        this.propagateDeploymentSelection(deploymentSelector);

        const credential =
          this.state.findCredentialForContentRecord(targetContentRecord);

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
          deploymentName: targetContentRecord.deploymentName,
          deploymentPath: targetContentRecord.deploymentPath,
          projectDir: targetContentRecord.projectDir,
        };
      }
      return undefined;
    } finally {
      // enable our home view, we are done with our sequence
      this.webviewConduit.sendMsg({
        kind: HostToWebviewMessageType.HIDE_DISABLE_OVERLAY,
      });
    }
  }

  public async showNewDeploymentMultiStep(
    viewId: string,
    projectDir?: string,
    entryPointFile?: string,
  ): Promise<PublishProcessParams | undefined> {
    // We need the initial queries to finish, before we can
    // use them (contentRecords, credentials and configs)
    await this.initComplete;
    try {
      // disable our home view, we are initiating a multi-step sequence
      this.webviewConduit.sendMsg({
        kind: HostToWebviewMessageType.SHOW_DISABLE_OVERLAY,
      });
      const deploymentObjects = await newDeployment(
        viewId,
        projectDir,
        entryPointFile,
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
          !this.state.findContentRecord(
            deploymentObjects.contentRecord.saveName,
            deploymentObjects.contentRecord.projectDir,
          )
        ) {
          this.state.contentRecords.push(deploymentObjects.contentRecord);
        }
        if (
          !this.state.findValidConfig(
            deploymentObjects.configuration.configurationName,
            deploymentObjects.configuration.projectDir,
          )
        ) {
          this.state.configurations.push(deploymentObjects.configuration);
        }
        if (!this.state.findCredential(deploymentObjects.credential.name)) {
          this.state.credentials.push(deploymentObjects.credential);
          refreshCredentials = true;
        }
        const deploymentSelector: DeploymentSelector = {
          deploymentPath: deploymentObjects.contentRecord.deploymentPath,
          deploymentName: deploymentObjects.contentRecord.saveName,
          projectDir: deploymentObjects.contentRecord.projectDir,
        };

        this.propagateDeploymentSelection(deploymentSelector);
        // Credentials aren't auto-refreshed, so we have to trigger it ourselves.
        if (refreshCredentials) {
          useBus().trigger("refreshCredentials", undefined);
        }
        return {
          deploymentName: deploymentObjects.contentRecord.deploymentName,
          deploymentPath: deploymentObjects.contentRecord.deploymentPath,
          projectDir: deploymentObjects.contentRecord.projectDir,
          credentialName: deploymentObjects.credential.name,
          configurationName: deploymentObjects.configuration.configurationName,
        };
      }
      return undefined;
    } finally {
      // enable our home view, we are done with the multi-step sequence
      this.webviewConduit.sendMsg({
        kind: HostToWebviewMessageType.HIDE_DISABLE_OVERLAY,
      });
    }
  }

  private async showNewCredential() {
    return await commands.executeCommand(Commands.HomeView.AddCredential);
  }

  private async showNewCredentialForDeployment() {
    const contentRecord = await this.state.getSelectedContentRecord();
    if (!contentRecord) {
      return;
    }

    return await commands.executeCommand(
      Commands.HomeView.AddCredential,
      contentRecord.serverUrl,
    );
  }

  /**
   * Add credential.
   *
   * Prompt the user for credential information. Then create or update the credential. Afterwards, refresh the provider.
   *
   * Once the server url is provided, the user is prompted with the url hostname as the default server name.
   */
  public addCredential = async (startingServerUrl?: string) => {
    const credential = await newCredential(Views.HomeView, startingServerUrl);
    if (credential) {
      useBus().trigger("refreshCredentials", undefined);
    }
  };

  /**
   * Deletes the supplied Credential
   */
  public deleteCredential = async (context: {
    credentialGUID: string;
    credentialName: string;
  }) => {
    const ok = await confirmDelete(
      `Are you sure you want to delete the credential '${context.credentialName}'?`,
    );
    if (!ok) {
      return;
    }
    try {
      const api = await useApi();
      await api.credentials.delete(context.credentialGUID);
      window.setStatusBarMessage(
        `Credential for ${context.credentialName} has been erased from our memory!`,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("credential::delete", error);
      window.showInformationMessage(summary);
    }
    useBus().trigger("refreshCredentials", undefined);
  };

  private showPublishingLog() {
    return commands.executeCommand(Commands.Logs.Focus);
  }

  private async showDeploymentQuickPick(
    contentRecordsSubset?: AllContentRecordTypes[],
    projectDir?: string,
  ): Promise<PublishProcessParams | undefined> {
    try {
      // disable our home view, we are initiating a multi-step sequence
      this.webviewConduit.sendMsg({
        kind: HostToWebviewMessageType.SHOW_DISABLE_OVERLAY,
      });

      // We need the latest lists. No choice but to refresh everything
      // once again.
      await this.refreshAll(true, true);

      // Create quick pick list from current contentRecords, credentials and configs
      let deploymentQuickPickList: DeploymentQuickPick[] = [];
      const lastContentRecord = await this.state.getSelectedContentRecord();
      const lastContentRecordName = lastContentRecord?.saveName;
      const lastContentRecordProjectDir = projectDir
        ? projectDir
        : lastContentRecord?.projectDir;
      const lastConfigName = lastContentRecord?.configurationName;
      const createNewDeploymentLabel = "Create a New Deployment";

      const includedContentRecords = contentRecordsSubset
        ? contentRecordsSubset
        : this.state.contentRecords;

      // Display New Deployment at beginning
      deploymentQuickPickList.push({
        label: "New",
        kind: QuickPickItemKind.Separator,
      });
      deploymentQuickPickList.push({
        iconPath: new ThemeIcon("plus"),
        label: createNewDeploymentLabel,
        detail: "(or pick one of the existing deployments below)", // we're forcing a blank here, just to maintain height of selection
        lastMatch: includedContentRecords.length ? false : true,
      });

      // Then we display the existing deployments
      if (includedContentRecords.length) {
        deploymentQuickPickList.push({
          label: "Existing",
          kind: QuickPickItemKind.Separator,
        });
      }
      const existingDeploymentQuickPickList: DeploymentQuickPick[] = [];
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
          config = this.state.findValidConfig(
            contentRecord.configurationName,
            contentRecord.projectDir,
          );
          if (!config) {
            config = this.state.findConfigInError(
              contentRecord.configurationName,
              contentRecord.projectDir,
            );
          }
        }

        let credential =
          this.state.findCredentialForContentRecord(contentRecord);

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
        if (credential?.name) {
          details.push(credential.name);
        } else {
          details.push(`Missing Credential for ${contentRecord.serverUrl}`);
          problem = true;
        }

        if (isRelativePathRoot(contentRecord.projectDir)) {
          if (config && !isConfigurationError(config)) {
            details.push(config.configuration.entrypoint);
          }
        } else {
          if (config && !isConfigurationError(config)) {
            details.push(
              `${contentRecord.projectDir}${path.sep}${config.configuration.entrypoint}`,
            );
          } else {
            details.push(`${contentRecord.projectDir}${path.sep}`);
          }
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
        existingDeploymentQuickPickList.push(deployment);
      });
      existingDeploymentQuickPickList.sort(
        (a: QuickPickItem, b: QuickPickItem) => {
          var x = a.label.toLowerCase();
          var y = b.label.toLowerCase();
          return x < y ? -1 : x > y ? 1 : 0;
        },
      );
      deploymentQuickPickList = deploymentQuickPickList.concat(
        existingDeploymentQuickPickList,
      );

      const toDispose: Disposable[] = [];
      const deployment = await new Promise<DeploymentQuickPick | undefined>(
        (resolve) => {
          const quickPick = window.createQuickPick<DeploymentQuickPick>();
          this.disposables.push(quickPick);

          quickPick.items = deploymentQuickPickList;
          const lastMatches = deploymentQuickPickList.filter(
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

      // If user selected create new, then switch over to that flow
      if (deployment?.label === createNewDeploymentLabel) {
        return this.showNewDeploymentMultiStep(Views.HomeView);
      }

      let deploymentSelector: DeploymentSelector | undefined;
      if (deployment && deployment.contentRecord) {
        deploymentSelector = {
          deploymentPath: deployment.contentRecord.deploymentPath,
          deploymentName: deployment.contentRecord.saveName,
          projectDir: deployment.contentRecord.projectDir,
        };
        this.updateWebViewViewCredentials();
        this.updateWebViewViewConfigurations();
        this.updateWebViewViewContentRecords(deploymentSelector);
        this.requestWebviewSaveSelection();
      }

      if (
        !deploymentSelector ||
        !deployment ||
        !deployment.contentRecord ||
        !deployment.detail ||
        !deployment.credentialName
      ) {
        return;
      }
      return {
        deploymentPath: deployment.contentRecord.deploymentPath,
        deploymentName: deployment.contentRecord.deploymentName,
        projectDir: deployment.contentRecord.projectDir,
        credentialName: deployment.credentialName,
        configurationName: deployment.contentRecord.configurationName,
      };
    } finally {
      // enable our home view, we are done with our sequence
      this.webviewConduit.sendMsg({
        kind: HostToWebviewMessageType.HIDE_DISABLE_OVERLAY,
      });
    }
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
        Uri.joinPath(this.extensionUri, "dist"),
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
    // and executes code based on the message that is received
    const disp = this.webviewConduit.onMsg(this.onConduitMessage.bind(this));
    if (disp) {
      this.disposables.push(disp);
    }
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
    // Custom Posit Publisher font
    const positPublisherFontCssUri = getUri(webview, extensionUri, [
      "dist",
      "posit-publisher-icons.css",
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
          <link rel="stylesheet" type="text/css" href="${positPublisherFontCssUri}">
          <title>Hello World</title>
        </head>
        <body>
          <div id="app"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  public refreshAll = async (
    forceAll?: boolean,
    includeSavedState?: boolean,
  ) => {
    try {
      await showProgress("Refreshing Data", Views.HomeView, async () => {
        const apis: Promise<void>[] = [this.refreshCredentialData()];
        if (forceAll) {
          // we have been told to refresh everything
          apis.push(this.refreshContentRecordData());
          apis.push(this.refreshConfigurationData());
        }
        return await Promise.all(apis);
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "refreshAll::Promise.all",
        error,
      );
      window.showInformationMessage(summary);
      return;
    }
    const selectedContentRecord = await this.state.getSelectedContentRecord();
    const selectedConfig = await this.state.getSelectedConfiguration();

    const selectionState = includeSavedState
      ? this.state.getSelection()
      : undefined;
    this.updateWebViewViewCredentials();
    this.updateWebViewViewConfigurations();
    this.updateWebViewViewContentRecords(selectionState || null);
    if (includeSavedState && selectionState) {
      useBus().trigger("activeContentRecordChanged", selectedContentRecord);
      useBus().trigger("activeConfigChanged", selectedConfig);
    }
  };

  private refreshContentRecordsMutex = new Mutex();
  public refreshContentRecords = () => {
    return throttleWithLastPending(
      this.refreshContentRecordsMutex,
      async () => {
        await this.refreshContentRecordData();
        this.updateWebViewViewContentRecords();
        useBus().trigger(
          "activeContentRecordChanged",
          await this.state.getSelectedContentRecord(),
        );
      },
    );
  };

  private refreshConfigurationsMutex = new Mutex();
  public refreshConfigurations = () => {
    return throttleWithLastPending(
      this.refreshConfigurationsMutex,
      async () => {
        await this.refreshConfigurationData();
        this.updateWebViewViewConfigurations();
        useBus().trigger(
          "activeConfigChanged",
          await this.state.getSelectedConfiguration(),
        );
      },
    );
  };

  public sendRefreshedFilesLists = async () => {
    const activeConfig = await this.state.getSelectedConfiguration();
    if (activeConfig) {
      try {
        const response = await showProgress(
          "Refreshing Files",
          Views.HomeView,
          async () => {
            const api = await useApi();
            return await api.files.getByConfiguration(
              activeConfig.configurationName,
              activeConfig.projectDir,
            );
          },
        );

        this.webviewConduit.sendMsg({
          kind: HostToWebviewMessageType.REFRESH_FILES,
          content: {
            files: response.data,
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

  public debounceSendRefreshedFilesLists = debounce(async () => {
    return await this.sendRefreshedFilesLists();
  }, DebounceDelaysMS.file);

  public initiatePublish(target: PublishProcessParams) {
    this.initiateDeployment(
      target.deploymentName,
      target.credentialName,
      target.configurationName,
      target.projectDir,
    );
  }

  public async handleFileInitiatedDeploymentSelection(uri: Uri) {
    // Guide the user to create a new Deployment with that file as the entrypoint
    // if one doesn’t exist
    // Select the Deployment with an active configuration for that entrypoint if there
    // is only one
    // With multiple, if a compatible one is already active, then do nothing.
    // Otherwise, prompt for selection between multiple compatible deployments

    const entrypointDir = relativeDir(uri);
    // If the file is outside the workspace, it cannot be an entrypoint
    if (entrypointDir === undefined) {
      return undefined;
    }
    const entrypointFile = uriUtils.basename(uri);

    const api = await useApi();

    await this.refreshAll(true, true);

    // We need the initial queries to finish, before we can
    // use them (contentRecords, credentials and configs)
    await this.initComplete;

    // get all of the deployments for projectDir
    // get the configs which are filtered for the entrypoint in that projectDir
    // determine a list of deployments that use those filtered configs

    let contentRecordList: (ContentRecord | PreContentRecord)[] = [];
    const getContentRecords = new Promise<void>(async (resolve, reject) => {
      try {
        const response = await api.contentRecords.getAll(entrypointDir, {
          recursive: false,
        });
        response.data.forEach((cfg) => {
          if (!isContentRecordError(cfg)) {
            contentRecordList.push(cfg);
          }
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "handleFileInitiatedDeploymentSelection, contentRecords.getAll",
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
        const response = await api.configurations.getAll(entrypointDir, {
          entrypoint: entrypointFile,
          recursive: false,
        });
        let rawConfigs = response.data;
        rawConfigs.forEach((cfg) => {
          if (!isConfigurationError(cfg)) {
            configMap.set(cfg.configurationName, cfg);
          }
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "handleFileInitiatedDeploymentSelection, configurations.getAll",
          error,
        );
        window.showErrorMessage(
          `Unable to continue with API Error: ${summary}`,
        );
        return reject();
      }
      resolve();
    });

    try {
      await showProgress(
        "Initializing::handleFileInitiatedDeployment",
        Views.HomeView,
        async () => {
          return await Promise.all([getContentRecords, getConfigurations]);
        },
      );
    } catch {
      // errors have already been displayed by the underlying promises..
      return undefined;
    }

    // Build up a list of compatible content records with this entrypoint
    // Unable to do this within the API because pre-deployments do not have
    // their entrypoint recorded.
    const compatibleContentRecords: (ContentRecord | PreContentRecord)[] = [];
    contentRecordList.forEach((cfg) => {
      if (configMap.get(cfg.configurationName)) {
        compatibleContentRecords.push(cfg);
      }
    });

    // if no deployments, create one
    if (!compatibleContentRecords.length) {
      // call new deployment
      const selected = await this.showNewDeploymentMultiStep(
        Views.HomeView,
        entrypointDir,
        entrypointFile,
      );
      return selected;
    }
    // only one deployment, just select it
    if (compatibleContentRecords.length === 1) {
      const contentRecord = compatibleContentRecords[0];
      const deploymentSelector: DeploymentSelector = {
        deploymentPath: contentRecord.deploymentPath,
        deploymentName: contentRecord.deploymentName,
        projectDir: contentRecord.projectDir,
      };
      await this.propagateDeploymentSelection(deploymentSelector);
      const credential =
        this.state.findCredentialForContentRecord(contentRecord);
      let credentialName = credential?.name;
      if (!credentialName) {
        try {
          // disable our home view, we are initiating a multi-step sequence
          // NOTE: Doing this here, because we don't always want newCredential
          // to disable the overlay (not necessary for add credential from credential view)
          this.webviewConduit.sendMsg({
            kind: HostToWebviewMessageType.SHOW_DISABLE_OVERLAY,
          });
          credentialName = await newCredential(
            Views.HomeView,
            contentRecord.serverUrl,
          );
          if (!credentialName) {
            return undefined;
          }
        } finally {
          // enable our home view, we are done with our sequence
          this.webviewConduit.sendMsg({
            kind: HostToWebviewMessageType.HIDE_DISABLE_OVERLAY,
          });
        }
      }
      const target: PublishProcessParams = {
        deploymentName: contentRecord.saveName,
        deploymentPath: contentRecord.deploymentPath,
        projectDir: contentRecord.projectDir,
        configurationName: contentRecord.configurationName,
        credentialName,
      };
      return target;
    }
    // if there are multiple compatible deployments, then make sure one of these isn't
    // already selected. If it is, do nothing, otherwise pick between the compatible ones.
    const currentContentRecord = await this.state.getSelectedContentRecord();
    if (
      !currentContentRecord ||
      !compatibleContentRecords.find((cfg) => {
        return cfg.deploymentPath === currentContentRecord.deploymentPath;
      })
    ) {
      // none of the compatible ones are selected
      const selected = await this.showDeploymentQuickPick(
        compatibleContentRecords,
        entrypointDir,
      );
      return selected;
    }
    // compatible content record already active. Publish
    const credential =
      this.state.findCredentialForContentRecord(currentContentRecord);
    let credentialName = credential?.name;
    if (!credentialName) {
      credentialName = await newCredential(
        Views.HomeView,
        currentContentRecord.serverUrl,
      );
      if (!credentialName) {
        return undefined;
      }
    }
    const target: PublishProcessParams = {
      deploymentName: currentContentRecord.saveName,
      deploymentPath: currentContentRecord.deploymentPath,
      projectDir: currentContentRecord.projectDir,
      credentialName,
      configurationName: currentContentRecord.configurationName,
    };
    return target;
  }

  /**
   * Cleans up and disposes of webview resources when view is disposed
   */
  public dispose() {
    Disposable.from(...this.disposables).dispose();

    this.state.dispose();
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
        this.refreshAll(true, true),
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
          const deployment = await this.state.getSelectedContentRecord();
          if (deployment) {
            await env.openExternal(Uri.parse(deployment.serverUrl));
          }
        },
      ),
      commands.registerCommand(
        Commands.HomeView.NavigateToDeploymentContent,
        async () => {
          const contentRecord = await this.state.getSelectedContentRecord();
          if (contentRecord && !isPreContentRecord(contentRecord)) {
            await env.openExternal(Uri.parse(contentRecord.dashboardUrl));
          }
        },
      ),
      commands.registerCommand(Commands.HomeView.ShowContentLogs, async () => {
        const contentRecord = await this.state.getSelectedContentRecord();
        if (contentRecord && !isPreContentRecord(contentRecord)) {
          await env.openExternal(Uri.parse(contentRecord.logsUrl));
        }
      }),
      commands.registerCommand(
        Commands.HomeView.EditCurrentConfiguration,
        async () => {
          const config = await this.state.getSelectedConfiguration();
          if (config) {
            return await commands.executeCommand(
              "vscode.open",
              Uri.file(config.configurationPath),
            );
          }
          console.error(
            "Ignoring ${Commands.HomeView.EditCurrentConfiguration} Command since no configuration is selected",
          );
          return undefined;
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
          const cfg = await this.state.getSelectedConfiguration();
          if (!cfg || isConfigurationError(cfg)) {
            return;
          }
          const packageFile = cfg.configuration.python?.packageFile;
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
        this.refreshPythonPackages,
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
          const cfg = await this.state.getSelectedConfiguration();
          if (!cfg || isConfigurationError(cfg)) {
            return;
          }
          const packageFile = cfg.configuration.r?.packageFile;
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
        this.refreshRPackages,
        this,
      ),
      commands.registerCommand(
        Commands.RPackages.Scan,
        this.onScanForRPackageRequirements,
        this,
      ),
    );

    this.context.subscriptions.push(
      commands.registerCommand(Commands.HomeView.OpenGettingStarted, () => {
        env.openExternal(
          Uri.parse(
            "https://github.com/posit-dev/publisher/blob/main/docs/index.md",
          ),
        );
      }),
    );

    this.context.subscriptions.push(
      commands.registerCommand(Commands.HomeView.OpenFeedback, () => {
        env.openExternal(
          Uri.parse("https://github.com/posit-dev/publisher/discussions"),
        );
      }),
    );

    this.context.subscriptions.push(
      commands.registerCommand(Commands.HomeView.RefreshCredentials, () =>
        useBus().trigger("refreshCredentials", undefined),
      ),
      commands.registerCommand(
        Commands.HomeView.AddCredential,
        this.addCredential,
      ),
      commands.registerCommand(
        Commands.HomeView.DeleteCredential,
        this.deleteCredential,
      ),
    );

    // directories
    watchers.positDir?.onDidDelete(() => {
      this.refreshContentRecords();
      this.refreshConfigurations();
    }, this);
    watchers.publishDir?.onDidDelete(() => {
      this.refreshContentRecords();
      this.refreshConfigurations();
    }, this);
    watchers.contentRecordsDir?.onDidDelete(this.refreshContentRecords, this);

    // configurations
    watchers.configurations?.onDidCreate(this.refreshConfigurations, this);
    watchers.configurations?.onDidChange(this.refreshConfigurations, this);
    watchers.configurations?.onDidDelete(this.refreshConfigurations, this);

    // content records
    watchers.contentRecords?.onDidCreate(this.refreshContentRecords, this);
    watchers.contentRecords?.onDidChange(this.refreshContentRecords, this);
    watchers.contentRecords?.onDidDelete(this.refreshContentRecords, this);

    // all files
    watchers.allFiles?.onDidCreate(this.debounceSendRefreshedFilesLists, this);
    watchers.allFiles?.onDidDelete(this.debounceSendRefreshedFilesLists, this);
  }
}
