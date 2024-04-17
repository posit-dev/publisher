// Copyright (C) 2024 by Posit Software, PBC.

import {
  Disposable,
  Webview,
  window,
  Uri,
  WebviewViewProvider,
  WebviewView,
  WebviewViewResolveContext,
  CancellationToken,
  ExtensionContext,
  workspace,
  WorkspaceFolder,
  RelativePattern,
  commands,
  env,
} from "vscode";
import { getUri } from "../utils/getUri";
import { getNonce } from "../utils/getNonce";
import {
  useApi,
  isConfigurationError,
  isDeploymentError,
  EventStreamMessage,
  Configuration,
  Deployment,
  PreDeployment,
  Account,
} from "../api";
import { getSummaryStringFromError } from "../utils/errors";
import { deployProject } from "./deployProgress";
import { EventStream } from "../events";

const deploymentFiles = ".posit/publish/deployments/*.toml";
const configFiles = ".posit/publish/*.toml";

const viewName = "posit.publisher.homeView";
const refreshCommand = viewName + ".refresh";
const contextIsSelectorExpanded = viewName + ".expanded";
const showBasicModeCommand = viewName + ".showBasicMode";
const showAdvancedModeCommand = viewName + ".showAdvancedMode";

const contextActiveMode = viewName + ".deploymentActiveMode";
const contextActiveModeAdvanced = "advanced-mode";
const contextActiveModeBasic = "basic-mode";

const lastSelectionState = viewName + ".lastSelectionState";
const lastExpansionState = viewName + ".lastExpansionState";

type HomeViewSelectionState = {
  deploymentName?: string;
  configurationName?: string;
  credentialName?: string;
};

export class HomeViewProvider implements WebviewViewProvider {
  private _disposables: Disposable[] = [];
  private _deployments: (Deployment | PreDeployment)[] = [];
  private _credentials: Account[] = [];
  private _configs: Configuration[] = [];
  private root: WorkspaceFolder | undefined;
  private _webviewView?: WebviewView;
  private _extensionUri: Uri;

  constructor(
    private readonly _context: ExtensionContext,
    private readonly _stream: EventStream,
  ) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
    this._extensionUri = this._context.extensionUri;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview this._context and
   * executes code based on the message that is received.
   */
  private async _setWebviewMessageListener() {
    if (!this._webviewView) {
      return;
    }
    this._webviewView.webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        switch (command) {
          case "deploy":
            const payload = JSON.parse(message.payload);
            try {
              const api = await useApi();
              const response = await api.deployments.publish(
                payload.deployment,
                payload.credential,
                payload.configuration,
              );
              deployProject(response.data.localId, this._stream);
            } catch (error: unknown) {
              const summary = getSummaryStringFromError(
                "homeView, deploy",
                error,
              );
              window.showInformationMessage(`Failed to deploy . ${summary}`);
              return;
            }
            return;
          // Add more switch case statements here as more webview message commands
          // are created within the webview this._context (i.e. inside media/main.js)
          case "initializing":
            // send back the data needed.
            await this.refreshAll(true);
            return;
          case "newDeployment":
            const preDeployment: PreDeployment = await commands.executeCommand(
              "posit.publisher.deployments.createNewDeploymentFile",
            );
            if (preDeployment) {
              this._updateDeploymentFileSelection(preDeployment);
            }
            break;
          case "editConfiguration":
            const config = this._configs.find(
              (config) => config.configurationName === message.payload,
            );
            if (config) {
              await commands.executeCommand(
                "vscode.open",
                Uri.file(config.configurationPath),
              );
            }
            break;
          case "newConfiguration":
            const newConfig: Configuration = await commands.executeCommand(
              "posit.publisher.configurations.add",
            );
            if (newConfig) {
              this._updateConfigFileSelection(newConfig);
            }
            break;
          case "navigate":
            env.openExternal(Uri.parse(message.payload));
            break;
          case "saveDeploymentButtonExpanded":
            const expanded: boolean = JSON.parse(message.payload);
            commands.executeCommand(
              "setContext",
              contextIsSelectorExpanded,
              expanded,
            );
            this._saveExpansionState(expanded);
            break;
          case "saveSelectionState":
            const state: HomeViewSelectionState = JSON.parse(message.payload);
            this._saveSelectionState(state);
            break;
        }
      },
      undefined,
      this._disposables,
    );
  }

  private _onPublishStart() {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "publish_start",
      });
    } else {
      window.showErrorMessage(
        "_onPublishStart: oops! No _webViewView defined!",
      );
      console.log("_onPublishStart: oops! No _webViewView defined!");
    }
  }

  private _onPublishSuccess(msg: EventStreamMessage) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "publish_finish_success",
        payload: msg,
      });
    } else {
      console.log("_onPublishSuccess: oops! No _webViewView defined!");
    }
  }

  private _onPublishFailure(msg: EventStreamMessage) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "publish_finish_failure",
        payload: msg,
      });
    } else {
      console.log("_onPublishFailure: oops! No _webViewView defined!");
    }
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
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "refresh_deployment_data",
        payload: JSON.stringify({
          deployments: this._deployments,
          selectedDeploymentName,
        }),
      });
    }
  }

  private _updateWebViewViewConfigurations(selectedConfigurationName?: string) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "refresh_config_data",
        payload: JSON.stringify({
          configurations: this._configs,
          selectedConfigurationName,
        }),
      });
    }
  }

  private _updateWebViewViewCredentials(selectedCredentialName?: string) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "refresh_credential_data",
        payload: JSON.stringify({
          credentials: this._credentials,
          selectedCredentialName,
        }),
      });
    }
  }

  private _updateDeploymentFileSelection(preDeployment: PreDeployment) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "update_deployment_selection",
        payload: JSON.stringify({
          preDeployment,
        }),
      });
    }
  }

  private _updateConfigFileSelection(config: Configuration) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "update_config_selection",
        payload: JSON.stringify({
          config,
        }),
      });
    }
  }

  private _updateWebViewViewExpansionState() {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "update_expansion_from_storage",
        payload: JSON.stringify({
          expansionState: this._context.workspaceState.get<boolean>(
            lastExpansionState,
            false,
          ),
        }),
      });
    }
  }

  private _saveSelectionState(state: HomeViewSelectionState) {
    return this._context.workspaceState.update(lastSelectionState, state);
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
    this._setWebviewMessageListener();
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
      ? this._context.workspaceState.get<HomeViewSelectionState>(
          lastSelectionState,
          {
            deploymentName: undefined,
            configurationName: undefined,
            credentialName: undefined,
          },
        )
      : undefined;
    this._updateWebViewViewCredentials(selectionState?.credentialName);
    this._updateWebViewViewConfigurations(selectionState?.configurationName);
    this._updateWebViewViewDeployments(selectionState?.deploymentName);
    this._updateWebViewViewExpansionState();
  };

  public refreshDeployments = async () => {
    await this._refreshDeploymentData();
    this._updateWebViewViewDeployments();
  };

  public refreshConfigurations = async () => {
    await this._refreshConfigurationData();
    this._updateWebViewViewConfigurations();
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
    this._stream.register("publish/success", (msg: EventStreamMessage) => {
      this._onPublishSuccess(msg);
    });
    this._stream.register("publish/failure", (msg: EventStreamMessage) => {
      this._onPublishFailure(msg);
    });
    commands.executeCommand("setContext", contextIsSelectorExpanded, false);

    this._context.subscriptions.push(
      commands.registerCommand(showBasicModeCommand, () => {
        commands.executeCommand(
          "setContext",
          contextActiveMode,
          contextActiveModeBasic,
        );
      }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(showAdvancedModeCommand, () => {
        commands.executeCommand(
          "setContext",
          contextActiveMode,
          contextActiveModeAdvanced,
        );
      }),
    );

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
