// Copyright (C) 2024 by Posit Software, PBC.

import {
  CancellationToken,
  Disposable,
  ExtensionContext,
  FileSystemWatcher,
  RelativePattern,
  ThemeIcon,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
  WorkspaceFolder,
  commands,
  env,
  window,
  workspace,
} from "vscode";
import { isAxiosError } from "axios";

import {
  Account,
  Configuration,
  Deployment,
  EventStreamMessage,
  FileAction,
  PreDeployment,
  PreDeploymentWithConfig,
  isConfigurationError,
  isDeploymentError,
  isPreDeployment,
  isPreDeploymentWithConfig,
  useApi,
} from "src/api";
import { useBus } from "src/bus";
import { EventStream } from "src/events";
import { getSummaryStringFromError } from "src/utils/errors";
import { getNonce } from "src/utils/getNonce";
import { getUri } from "src/utils/getUri";
import { deployProject } from "src/views/deployProgress";
import { WebviewConduit } from "src/utils/webviewConduit";
import { fileExists } from "src/utils/files";

import type { Destination, HomeViewState } from "src/types/shared";
import {
  DeployMsg,
  EditConfigurationMsg,
  NavigateMsg,
  SaveDeploymentButtonExpandedMsg,
  SaveSelectionStatedMsg,
  WebviewToHostMessage,
  WebviewToHostMessageType,
  VSCodeOpenRelativeMsg,
} from "src/types/messages/webviewToHostMessages";
import { HostToWebviewMessageType } from "src/types/messages/hostToWebviewMessages";
import { confirmOverwrite } from "src/dialogs";
import { splitFilesOnInclusion } from "src/utils/files";
import { DestinationQuickPick } from "src/types/quickPicks";
import { normalizeURL } from "src/utils/url";

const deploymentFiles = ".posit/publish/deployments/*.toml";
const configFiles = ".posit/publish/*.toml";

const viewName = "posit.publisher.homeView";
const refreshCommand = viewName + ".refresh";
const deployWithDiffConfigCommand = viewName + ".deployWithDiffConfig";
const selectDestinationCommand = viewName + ".selectDestination";
const contextIsSelectorExpanded = viewName + ".expanded";
const contextIsHomeViewInitialized = viewName + ".initialized";

enum HomeViewInitialized {
  initialized = "initialized",
  uninitialized = "uninitialized",
}

const lastSelectionState = viewName + ".lastSelectionState.v2";
const lastExpansionState = viewName + ".lastExpansionState.v1";

export class HomeViewProvider implements WebviewViewProvider {
  private _disposables: Disposable[] = [];
  private _deployments: (
    | Deployment
    | PreDeployment
    | PreDeploymentWithConfig
  )[] = [];
  private _credentials: Account[] = [];
  private _configs: Configuration[] = [];
  private root: WorkspaceFolder | undefined;
  private _webviewView?: WebviewView;
  private _extensionUri: Uri;
  private _webviewConduit: WebviewConduit;

  private activeConfigFileWatcher: FileSystemWatcher | undefined;

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
    useBus().on("requestActiveConfig", () => {
      useBus().trigger("activeConfigChanged", this._getActiveConfig());
    });
    useBus().on("requestActiveDeployment", () => {
      useBus().trigger("activeDeploymentChanged", this._getActiveDeployment());
    });
    useBus().on("requestActiveCredential", () => {
      useBus().trigger("activeCredentialChanged", this._getActiveCredential());
    });

    useBus().on("activeConfigChanged", (cfg: Configuration | undefined) => {
      this.sendRefreshedFilesLists();
      this._onRefreshPythonPackages();
      this.createActiveConfigFileWatcher(cfg);
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
      case WebviewToHostMessageType.NEW_DEPLOYMENT:
        return await this._onNewDeploymentMsg();
      case WebviewToHostMessageType.EDIT_CONFIGURATION:
        return await this._onEditConfigurationMsg(msg);
      case WebviewToHostMessageType.NEW_CONFIGURATION:
        return await this._onNewConfigurationMsg();
      case WebviewToHostMessageType.NAVIGATE:
        return await this._onNavigateMsg(msg);
      case WebviewToHostMessageType.SAVE_DEPLOYMENT_BUTTON_EXPANDED:
        return await this._onSaveDeploymentButtonExpandedMsg(msg);
      case WebviewToHostMessageType.SAVE_SELECTION_STATE:
        return await this._onSaveSelectionState(msg);
      case WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES:
        return await this._onRefreshPythonPackages();
      case WebviewToHostMessageType.VSCODE_OPEN_RELATIVE:
        return await this._onRelativeOpenVSCode(msg);
      case WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS:
        return await this._onScanForPythonPackageRequirements();
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
      default:
        throw new Error(
          `Error: _onConduitMessage unhandled msg: ${JSON.stringify(msg)}`,
        );
    }
  }

  private async _onDeployMsg(msg: DeployMsg) {
    try {
      const api = await useApi();
      const response = await api.deployments.publish(
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

  private async _onNewDeploymentMsg() {
    const preDeployment: PreDeployment = await commands.executeCommand(
      "posit.publisher.deployments.createNewDeploymentFile",
    );
    if (preDeployment) {
      this._updateDeploymentFileSelection(preDeployment, true);
    }
  }

  private async _onEditConfigurationMsg(msg: EditConfigurationMsg) {
    const config = this._configs.find(
      (config) => config.configurationName === msg.content.configurationName,
    );
    if (config) {
      await commands.executeCommand(
        "vscode.open",
        Uri.file(config.configurationPath),
      );
    }
  }

  private async _onNewConfigurationMsg() {
    const newConfig: Configuration = await commands.executeCommand(
      "posit.publisher.configurations.add",
      viewName,
    );
    if (newConfig) {
      this._updateConfigFileSelection(newConfig, true);
    }
  }

  private async _onNavigateMsg(msg: NavigateMsg) {
    await env.openExternal(Uri.parse(msg.content.uriPath));
  }

  private async _onSaveDeploymentButtonExpandedMsg(
    msg: SaveDeploymentButtonExpandedMsg,
  ) {
    await commands.executeCommand(
      "setContext",
      contextIsSelectorExpanded,
      msg.content.expanded,
    );
    await this._saveExpansionState(msg.content.expanded);
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

  private async _refreshDeploymentData() {
    try {
      // API Returns:
      // 200 - success
      // 500 - internal server error
      const api = await useApi();
      const response = await api.deployments.getAll();
      const deployments = response.data;
      this._deployments = [];
      deployments.forEach((deployment) => {
        if (!isDeploymentError(deployment)) {
          this._deployments.push(deployment);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "_refreshDeploymentData::deployments.getAll",
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
      configurations.forEach((config) => {
        if (!isConfigurationError(config)) {
          this._configs.push(config);
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
      const response = await api.accounts.getAll();
      this._credentials = response.data;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "_refreshCredentialData::accounts.getAll",
        error,
      );
      window.showInformationMessage(summary);
      throw error;
    }
  }

  private _updateWebViewViewDeployments(selectedDeploymentName?: string) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_DEPLOYMENT_DATA,
      content: {
        deployments: this._deployments,
        selectedDeploymentName,
      },
    });
  }

  private _updateWebViewViewConfigurations(selectedConfigurationName?: string) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CONFIG_DATA,
      content: {
        configurations: this._configs,
        selectedConfigurationName,
      },
    });
  }

  private _updateWebViewViewCredentials(selectedCredentialName?: string) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA,
      content: {
        credentials: this._credentials,
        selectedCredentialName,
      },
    });
  }

  private _updateDeploymentFileSelection(
    preDeployment: PreDeployment,
    saveSelection = false,
  ) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.UPDATE_DEPLOYMENT_SELECTION,
      content: {
        preDeployment,
        saveSelection,
      },
    });
  }

  private _updateConfigFileSelection(
    config: Configuration,
    saveSelection = false,
  ) {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.UPDATE_CONFIG_SELECTION,
      content: {
        config,
        saveSelection,
      },
    });
  }

  private _requestWebviewSaveSelection() {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.SAVE_SELECTION,
    });
  }

  private _updateWebViewViewExpansionState() {
    this._webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.UPDATE_EXPANSION_FROM_STORAGE,
      content: {
        expansionState: this._context.workspaceState.get<boolean>(
          lastExpansionState,
          false,
        ),
      },
    });
  }

  private _getSelectionState(): HomeViewState {
    const state = this._context.workspaceState.get<HomeViewState>(
      lastSelectionState,
      {
        deploymentName: undefined,
        configurationName: undefined,
        credentialName: undefined,
      },
    );
    return state;
  }

  private _getActiveConfig(): Configuration | undefined {
    const savedState = this._getSelectionState();
    return this.getConfigByName(savedState.configurationName);
  }

  private _getActiveDeployment(): Deployment | PreDeployment | undefined {
    const savedState = this._getSelectionState();
    return this.getDeploymentByName(savedState.deploymentName);
  }

  private _getActiveCredential(): Account | undefined {
    const savedState = this._getSelectionState();
    return this.getCredentialByName(savedState.credentialName);
  }

  private getDeploymentByName(name: string | undefined) {
    return this._deployments.find((d) => d.deploymentName === name);
  }

  private getConfigByName(name: string | undefined) {
    return this._configs.find((c) => c.configurationName === name);
  }

  private getCredentialByName(name: string | undefined) {
    return this._credentials.find((c) => c.name === name);
  }

  private async _saveSelectionState(state: HomeViewState): Promise<void> {
    await this._context.workspaceState.update(lastSelectionState, state);

    useBus().trigger("activeDeploymentChanged", this._getActiveDeployment());
    useBus().trigger("activeConfigChanged", this._getActiveConfig());
    useBus().trigger("activeCredentialChanged", this._getActiveCredential());
  }

  private _saveExpansionState(expanded: boolean) {
    return this._context.workspaceState.update(lastExpansionState, expanded);
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
            await api.requirements.getByConfiguration(activeConfiguration);
          packages = response.data.requirements;
        } catch (error: unknown) {
          if (isAxiosError(error) && error.response?.status === 404) {
            // No requirements file; show the welcome view.
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
      await api.requirements.create(relPathPackageFile);
      await commands.executeCommand("vscode.open", fileUri);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "homeView::_onScanForPythonPackageRequirements",
        error,
      );
      window.showInformationMessage(summary);
    }
  }

  private async showDestinationQuickPick(
    lastDeploymentName?: string,
    lastConfigName?: string,
    lastCredentialName?: string,
  ): Promise<Destination | undefined> {
    // Create quick pick list from current deployments, credentials and configs
    const destinations: DestinationQuickPick[] = [];

    this._deployments.forEach((deployment) => {
      if (
        isDeploymentError(deployment) ||
        (isPreDeployment(deployment) && !isPreDeploymentWithConfig(deployment))
      ) {
        // we won't include these for now. Perhaps in the future, we can show them
        // as disabled.
        return;
      }

      let config: Configuration | undefined;
      if (deployment.configurationName) {
        config = this._configs.find(
          (config) => config.configurationName === deployment.configurationName,
        );
      }

      let credential = this._credentials.find(
        (credential) =>
          normalizeURL(credential.url).toLowerCase() ===
          normalizeURL(deployment.serverUrl).toLowerCase(),
      );

      let title = deployment.saveName;
      let problem = false;

      let configName = config?.configurationName;
      if (!configName) {
        configName = deployment.configurationName
          ? `${deployment.configurationName} - ERROR: Config Not Found!`
          : `ERROR: No Config Entry in Deployment file - ${deployment.saveName}`;
        problem = true;
      }

      let credentialName = credential?.name;
      if (!credentialName) {
        credentialName = `${deployment.serverUrl} - ERROR: No Matching Credential!`;
        problem = true;
      }

      let lastMatch =
        lastDeploymentName === deployment.saveName &&
        lastConfigName === configName &&
        lastCredentialName === credentialName;

      const destination: DestinationQuickPick = {
        label: title,
        description: configName,
        detail: credentialName,
        iconPath: problem
          ? new ThemeIcon("error")
          : new ThemeIcon("cloud-upload"),
        deployment,
        config,
        credential,
        lastMatch,
      };
      // Should we not push destinations with no config or matching credentials?
      destinations.push(destination);
    });

    const toDispose: Disposable[] = [];
    const destination = await new Promise<DestinationQuickPick | undefined>(
      (resolve) => {
        const quickPick = window.createQuickPick<DestinationQuickPick>();
        this._disposables.push(quickPick);

        quickPick.items = destinations;
        const lastMatches = destinations.filter(
          (destination) => destination.lastMatch,
        );
        if (lastMatches) {
          quickPick.activeItems = lastMatches;
        }
        quickPick.title = "Select Destination";
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

    let result: Destination | undefined;
    if (destination) {
      result = {
        deploymentName: destination.deployment.saveName,
        configurationName: destination.config?.configurationName,
        credentialName: destination.credential?.name,
      };
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
        this._refreshDeploymentData(),
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
    this._updateWebViewViewCredentials(selectionState?.credentialName);
    this._updateWebViewViewConfigurations(selectionState?.configurationName);
    this._updateWebViewViewDeployments(selectionState?.deploymentName);
    this._updateWebViewViewExpansionState();
    if (includeSavedState && selectionState) {
      useBus().trigger("activeDeploymentChanged", this._getActiveDeployment());
      useBus().trigger("activeConfigChanged", this._getActiveConfig());
      useBus().trigger("activeCredentialChanged", this._getActiveCredential());
    }
  };

  public refreshDeployments = async () => {
    await this._refreshDeploymentData();
    this._updateWebViewViewDeployments();
    useBus().trigger("activeDeploymentChanged", this._getActiveDeployment());
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
    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private createActiveConfigFileWatcher(cfg: Configuration | undefined) {
    if (this.root === undefined || cfg === undefined) {
      return;
    }

    const watcher = workspace.createFileSystemWatcher(
      new RelativePattern(this.root, cfg.configurationPath),
    );
    watcher.onDidChange(this.sendRefreshedFilesLists);

    if (this.activeConfigFileWatcher) {
      // Dispose the previous configuration file watcher
      this.activeConfigFileWatcher.dispose();
      const index = this._context.subscriptions.indexOf(
        this.activeConfigFileWatcher,
      );
      if (index !== -1) {
        this._context.subscriptions.splice(index, 1);
      }
    }

    this.activeConfigFileWatcher = watcher;
    this._context.subscriptions.push(watcher);
  }

  public register() {
    this._stream.register("publish/start", () => {
      this._onPublishStart();
    });
    this._stream.register("publish/success", () => {
      this._onPublishSuccess();
    });
    this._stream.register("publish/failure", (msg: EventStreamMessage) => {
      this._onPublishFailure(msg);
    });
    commands.executeCommand("setContext", contextIsSelectorExpanded, false);

    this._context.subscriptions.push(
      window.registerWebviewViewProvider(viewName, this, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        selectDestinationCommand,
        this.showDestinationQuickPick,
        this,
      ),
    );

    this._context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refreshAll),
      commands.registerCommand(deployWithDiffConfigCommand, () =>
        console.log("deploying with different configuration command executed"),
      ),
    );

    if (this.root !== undefined) {
      const configFileWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, configFiles),
      );
      configFileWatcher.onDidCreate(this.refreshConfigurations);
      configFileWatcher.onDidDelete(this.refreshConfigurations);
      configFileWatcher.onDidChange(this.refreshConfigurations);
      this._context.subscriptions.push(configFileWatcher);

      const deploymentFileWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, deploymentFiles),
      );
      deploymentFileWatcher.onDidCreate(this.refreshDeployments);
      deploymentFileWatcher.onDidDelete(this.refreshDeployments);
      deploymentFileWatcher.onDidChange(this.refreshDeployments);
      this._context.subscriptions.push(deploymentFileWatcher);

      const allFileWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, "**"),
      );
      allFileWatcher.onDidCreate(this.sendRefreshedFilesLists);
      allFileWatcher.onDidDelete(this.sendRefreshedFilesLists);
      this._context.subscriptions.push(allFileWatcher);
    }
  }
}
