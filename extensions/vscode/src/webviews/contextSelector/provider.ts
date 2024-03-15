import { ExtensionContext, window } from "vscode";

import {
  CancellationToken,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { getWebViewUri, getNonce } from "../../utils/identifiers";
// import * as weather from "weather-js";
// import { createContentSecurityPolicyContent } from "src/panels";

export class ContextSelectorViewProvider implements WebviewViewProvider {
  public static readonly viewType = "posit.publisher.contextSelector";

  constructor(private readonly _extensionUri: Uri) { }

  public resolveWebviewView(
    webviewView: WebviewView,
    _: WebviewViewResolveContext,
    _token: CancellationToken
  ) {
    // Allow scripts in the webview
    webviewView.webview.options = {
      // Enable JavaScript in the webview
      enableScripts: true,
      // Restrict the webview to only load resources from the `out/contextSelector` directory
      localResourceRoots: [Uri.joinPath(this._extensionUri, 'out', 'contextSelector')],
    };

    // Set the HTML content that will fill the webview view
    webviewView.webview.html = this._getWebviewContent(webviewView.webview, this._extensionUri);

    // Sets up an event listener to listen for messages passed from the webview view context
    // and executes code based on the message that is recieved
    this._setWebviewMessageListener(webviewView);
  }

  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    const webviewUri = getWebViewUri(webview, extensionUri, ['out', 'contextSelector', 'main.js']);
    const stylesUri = getWebViewUri(webview, extensionUri, ['out', 'contextSelector', 'styles.css']);
    const nonce = getNonce();


    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy"
          content="default-src 'self' vscode-resource: https:;
                  script-src vscode-resource: 'self' 'unsafe-inline' 'unsafe-eval' https:;
                  style-src vscode-resource: 'self' 'unsafe-inline';
                  img-src 'self' vscode-resource: data:"/>
					<link rel="stylesheet" href="${stylesUri}">
					<title>Deployment</title>
				</head>
				<body>
          <h1>Deployment</h1>
            <section id="filter-container">
              <section class="option-group">
                <p class="labels">Deployment:</p>
                <vscode-dropdown id="deployment">
                  <vscode-option value="1">Untitled-1</vscode-option>
                  <vscode-option value="2">bcd</vscode-option>
                </vscode-dropdown>
              </section>
              <section class="option-group">
                <p class="labels">Config:</p>
                <vscode-dropdown id="config">
                  <vscode-option value="1">default</vscode-option>
                </vscode-dropdown>
              </section>
              <section class="option-group">
                <p class="labels">Credential:</p>
                <vscode-dropdown id="credential">
                  <vscode-option value="1">local-prod</vscode-option>
                  <vscode-option value="2">local-pw-admin</vscode-option>
                </vscode-dropdown>
              </section>
              <vscode-button id="deploy-button">Deploy</vscode-button>
              <vscode-progress-ring id="loading" class="hidden"></vscode-progress-ring>
            </section>
          <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
				</body>
			</html>
		`;
  }

  private _setWebviewMessageListener(webviewView: WebviewView) {
    webviewView.webview.onDidReceiveMessage((message) => {
      const command = message.command;

      switch (command) {
        case 'loaded':
          break;
        case 'initiateDeployment':
          break;

        // case "weather":
        //   weather.find({ search: location, degreeType: unit }, (err: any, result: any) => {
        //     if (err) {
        //       webviewView.webview.postMessage({
        //         command: "error",
        //         message: "Sorry couldn't get weather at this time...",
        //       });
        //       return;
        //     }
        //     // Get the weather forecast results
        //     const weatherForecast = result[0];
        //     // Pass the weather forecast object to the webview
        //     webviewView.webview.postMessage({
        //       command: "weather",
        //       payload: JSON.stringify(weatherForecast),
        //     });
        //   });
        //   break;
      }
    });
  }

  public register(context: ExtensionContext) {
    context.subscriptions.push(
      window.registerWebviewViewProvider(
        ContextSelectorViewProvider.viewType,
        this
      )
    );
  }
}
