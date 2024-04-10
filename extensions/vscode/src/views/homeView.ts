// Copyright (C) 2024 by Posit Software, PBC.

import {
  CancellationToken,
  Disposable,
  ExtensionContext,
  FileSystemWatcher,
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
import { EventStream } from "../events";
import { getSummaryStringFromError } from "../utils/errors";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { deployProject } from "./deployProgress";

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
  private configFileWatcher: FileSystemWatcher | undefined;
  private deploymentFileWatcher: FileSystemWatcher | undefined;

  constructor(
    private context: ExtensionContext,
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

            // and watch for future changes
            if (this.root !== undefined) {
              if (this.configFileWatcher === undefined) {
                this.configFileWatcher = this.createConfigFileWatcher(
                  this.root,
                );
              }
              if (this.deploymentFileWatcher === undefined) {
                this.deploymentFileWatcher = this.createDeploymentFileWatcher(
                  this.root,
                );
              }
            }

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
          configurations: this._configs,
          credentials: this._credentials,
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
        Uri.joinPath(this.context.extensionUri, "out", "webviews", "homeView"),
      ],
    };

    // Set the HTML content that will fill the webview view
    webviewView.webview.html = this._getWebviewContent(
      webviewView.webview,
      this.context.extensionUri,
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
    console.log("refreshing files");
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

  public register() {
    const provider = window.registerWebviewViewProvider(viewName, this, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    });
    this.context.subscriptions.push(provider);

    this.context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh),
    );
  }

  private createConfigFileWatcher(root: WorkspaceFolder): FileSystemWatcher {
    console.log(`home: Creating watcher for ${root.uri} ${configFiles}`);
    const configFileWatcher = workspace.createFileSystemWatcher(
      new RelativePattern(root, configFiles),
    );
    configFileWatcher.onDidCreate(this.refresh);
    configFileWatcher.onDidDelete(this.refresh);
    configFileWatcher.onDidChange(this.refresh);
    this.context.subscriptions.push(configFileWatcher);
    return configFileWatcher;
  }

  private createDeploymentFileWatcher(
    root: WorkspaceFolder,
  ): FileSystemWatcher {
    console.log(`home: Creating watcher for ${root.uri} ${deploymentFiles}`);
    const deploymentFileWatcher = workspace.createFileSystemWatcher(
      new RelativePattern(root, deploymentFiles),
    );
    deploymentFileWatcher.onDidCreate(this.refresh);
    deploymentFileWatcher.onDidDelete(this.refresh);
    deploymentFileWatcher.onDidChange(this.refresh);
    this.context.subscriptions.push(deploymentFileWatcher);
    return deploymentFileWatcher;
  }
}
