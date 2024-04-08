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

export class HomeViewProvider implements WebviewViewProvider {
  private _disposables: Disposable[] = [];
  private api = useApi();
  private _deployments: (Deployment | PreDeployment)[] = [];
  private _credentials: Account[] = [];
  private _configs: Configuration[] = [];
  private root: WorkspaceFolder | undefined;
  private _webviewView?: WebviewView;

  constructor(
    private readonly _extensionUri: Uri,
    private readonly stream: EventStream,
  ) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
    stream.register("publish/start", () => {
      this._onPublishStart();
    });
    stream.register("publish/success", (msg: EventStreamMessage) => {
      this._onPublishSuccess(msg);
    });
    stream.register("publish/failure", (msg: EventStreamMessage) => {
      this._onPublishFailure(msg);
    });
    commands.executeCommand("setContext", contextIsSelectorExpanded, false);

    commands.registerCommand(showBasicModeCommand, () => {
      commands.executeCommand(
        "setContext",
        contextActiveMode,
        contextActiveModeBasic,
      );
    });

    commands.registerCommand(showAdvancedModeCommand, () => {
      commands.executeCommand(
        "setContext",
        contextActiveMode,
        contextActiveModeAdvanced,
      );
    });
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private _setWebviewMessageListener() {
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
              const response = await this.api.deployments.publish(
                payload.deployment,
                payload.credential,
                payload.configuration,
              );
              deployProject(response.data.localId, this.stream);
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
          // are created within the webview context (i.e. inside media/main.js)
          case "initializing":
            // send back the data needed.
            await this._refreshData();
            this._refreshWebViewViewData();
            return;
          case "newDeployment":
            const newFile: string = await commands.executeCommand(
              "posit.publisher.deployments.createNewDeploymentFile",
            );
            if (newFile) {
              this._updateDeploymentFileSelection(newFile);
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
            const newConfig: string = await commands.executeCommand(
              "posit.publisher.configurations.add",
            );
            if (newConfig) {
              this._updateConfigFileSelection(newConfig);
            }
            break;
          case "expanded":
            commands.executeCommand(
              "setContext",
              contextIsSelectorExpanded,
              true,
            );
            break;
          case "collapsed":
            commands.executeCommand(
              "setContext",
              contextIsSelectorExpanded,
              false,
            );
            break;
          case "navigate":
            env.openExternal(Uri.parse(message.payload));
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

  private async _refreshData() {
    try {
      // API Returns:
      // 200 - success
      // 500 - internal server error
      const response = await this.api.deployments.getAll();
      const deployments = response.data;
      this._deployments = [];
      deployments.forEach((deployment) => {
        if (!isDeploymentError(deployment)) {
          this._deployments.push(deployment);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "_refreshData::deployments.getAll",
        error,
      );
      window.showInformationMessage(summary);
    }

    try {
      const response = await this.api.accounts.getAll();
      this._credentials = response.data;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "_refreshData::accounts.getAll",
        error,
      );
      window.showInformationMessage(summary);
    }

    try {
      const response = await this.api.configurations.getAll();
      const configurations = response.data;
      this._configs = [];
      configurations.forEach((config) => {
        if (!isConfigurationError(config)) {
          this._configs.push(config);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "configurations::getChildren",
        error,
      );
      window.showInformationMessage(summary);
    }
  }

  private _refreshWebViewViewData() {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "refresh_data",
        payload: JSON.stringify({
          deployments: this._deployments,
          configurations: this._configs.map(
            (config) => config.configurationName,
          ),
          credentials: this._credentials,
        }),
      });
    }
  }

  private _updateDeploymentFileSelection(name: string) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "update_deployment_selection",
        payload: JSON.stringify({
          name,
        }),
      });
    }
  }

  private _updateConfigFileSelection(name: string) {
    if (this._webviewView) {
      this._webviewView.webview.postMessage({
        command: "update_config_selection",
        payload: JSON.stringify({
          name,
        }),
      });
    }
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

    // Sets up an event listener to listen for messages passed from the webview view context
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

  public refresh = async (_: Uri) => {
    await this._refreshData();
    this._refreshWebViewViewData();
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

  public register(context: ExtensionContext) {
    const provider = window.registerWebviewViewProvider(viewName, this, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    });
    context.subscriptions.push(provider);

    context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh),
    );

    if (this.root !== undefined) {
      const configFileWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, configFiles),
      );
      configFileWatcher.onDidCreate(this.refresh);
      configFileWatcher.onDidDelete(this.refresh);
      configFileWatcher.onDidChange(this.refresh);
      context.subscriptions.push(configFileWatcher);

      const deploymentFileWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, deploymentFiles),
      );
      deploymentFileWatcher.onDidCreate(this.refresh);
      deploymentFileWatcher.onDidDelete(this.refresh);
      deploymentFileWatcher.onDidChange(this.refresh);
      context.subscriptions.push(deploymentFileWatcher);
    }
  }
}
