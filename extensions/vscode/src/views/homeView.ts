// Copyright (C) 2024 by Posit Software, PBC.

import {
  CancellationToken,
  Disposable,
  ExtensionContext,
  RelativePattern,
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
import {
  Account,
  Configuration,
  Deployment,
  EventStreamMessage,
  PreDeployment,
  isConfigurationError,
  isDeploymentError,
  useApi,
} from "../api";
import { useBus } from "../bus";
import { EventStream } from "../events";
import { getSummaryStringFromError } from "../utils/errors";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { deployProject } from "./deployProgress";
import { WebviewConduit } from "../utils/webviewConduit";
import {
  ConduitMessage,
  DeployMsg,
  EditConfigurationMsg,
  MessageType,
  NavigateMsg,
  SaveDeploymentButtonExpandedMsg,
  SaveSelectionStatedMsg,
} from "../messages";

import type { HomeViewState } from "../types/shared";

const deploymentFiles = ".posit/publish/deployments/*.toml";
const configFiles = ".posit/publish/*.toml";

const viewName = "posit.publisher.homeView";
const refreshCommand = viewName + ".refresh";
const contextIsSelectorExpanded = viewName + ".expanded";

const lastSelectionState = viewName + ".lastSelectionState.v2";
const lastExpansionState = viewName + ".lastExpansionState.v1";

export class HomeViewProvider implements WebviewViewProvider {
  private _disposables: Disposable[] = [];
  private _deployments: (Deployment | PreDeployment)[] = [];
  private _credentials: Account[] = [];
  private _configs: Configuration[] = [];
  private root: WorkspaceFolder | undefined;
  private _webviewView?: WebviewView;
  private _extensionUri: Uri;
  private _webviewConduit: WebviewConduit;

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
  }
  /**
   * Dispatch messages passed from the webview to the handling code
   */
  private async _onConduitMessage(msg: ConduitMessage) {
    switch (msg.kind) {
      case MessageType.DEPLOY:
        return await this._onDeployMsg(msg);
      case MessageType.INITIALIZING:
        return await this._onInitializingMsg();
      case MessageType.NEW_DEPLOYMENT:
        return await this._onNewDeploymentMsg();
      case MessageType.EDIT_CONFIGURATION:
        return await this._onEditConfigurationMsg(msg);
      case MessageType.NEW_CONFIGURATION:
        return await this._onNewConfigurationMsg();
      case MessageType.NAVIGATE:
        return await this._onNavigateMsg(msg);
      case MessageType.SAVE_DEPLOYMENT_BUTTON_EXPANDED:
        return await this._onSaveDeploymentButtonExpandedMsg(msg);
      case MessageType.SAVE_SELECTION_STATE:
        return await this._onSaveSelectionState(msg);
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
    // On first run, we have no saved state. Trigger a save
    // so we have the state, and can notify dependent views.
    this._requestWebviewSaveSelection();
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

  private _onPublishStart() {
    this._webviewConduit.sendMsg({
      kind: MessageType.PUBLISH_START,
      content: {},
    });
  }

  private _onPublishSuccess() {
    this._webviewConduit.sendMsg({
      kind: MessageType.PUBLISH_FINISH_SUCCESS,
      content: {},
    });
  }

  private _onPublishFailure(msg: EventStreamMessage) {
    this._webviewConduit.sendMsg({
      kind: MessageType.PUBLISH_FINISH_FAILURE,
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
      kind: MessageType.REFRESH_DEPLOYMENT_DATA,
      content: {
        deployments: this._deployments,
        selectedDeploymentName,
      },
    });
  }

  private _updateWebViewViewConfigurations(selectedConfigurationName?: string) {
    this._webviewConduit.sendMsg({
      kind: MessageType.REFRESH_CONFIG_DATA,
      content: {
        configurations: this._configs,
        selectedConfigurationName,
      },
    });
  }

  private _updateWebViewViewCredentials(selectedCredentialName?: string) {
    this._webviewConduit.sendMsg({
      kind: MessageType.REFRESH_CREDENTIAL_DATA,
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
      kind: MessageType.UPDATE_DEPLOYMENT_SELECTION,
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
      kind: MessageType.UPDATE_CONFIG_SELECTION,
      content: {
        config,
        saveSelection,
      },
    });
  }

  private _requestWebviewSaveSelection() {
    this._webviewConduit.sendMsg({
      kind: MessageType.SAVE_SELECTION,
      content: {},
    });
  }

  private _updateWebViewViewExpansionState() {
    this._webviewConduit.sendMsg({
      kind: MessageType.UPDATE_EXPANSION_FROM_STORAGE,
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
      // Restrict the webview to only load resources from the `out` directory
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, "out", "webviews", "homeView"),
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
      "out",
      "webviews",
      "homeView",
      "index.css",
    ]);
    // const codiconsUri = webview.asWebviewUri(Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
    // The JS file from the Vue build output
    const scriptUri = getUri(webview, extensionUri, [
      "out",
      "webviews",
      "homeView",
      "index.js",
    ]);
    // The codicon css (and related tff file) are needing to be loaded for icons
    const codiconsUri = getUri(webview, extensionUri, [
      "out",
      "webviews",
      "homeView",
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
      commands.registerCommand(refreshCommand, this.refreshAll),
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
    }
  }
}
