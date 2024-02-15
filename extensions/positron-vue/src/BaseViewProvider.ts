import * as vscode from 'vscode'
import { handleMessages } from './messenger'

export class BaseViewProvider implements vscode.WebviewViewProvider {
	// 'base-view-sidebar-1'
  public viewType: string;

	private _view?: vscode.WebviewView

  // 'dist/compiled/webViewView1'
  private _distLocation: string

	constructor(
		private readonly _extensionUri: vscode.Uri,
    private readonly distLocation: string,
    private readonly viewTypeString: string,
	) { 
    this._distLocation = distLocation;
    this.viewType = viewTypeString;
  }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		}

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, this._distLocation);
	}

	private _getHtmlForWebview(webview: vscode.Webview, distLocation: string) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, distLocation, 'index.es.js'))

		// Do the same for the stylesheet.
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'output.css'))

		handleMessages(webview)

		return `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">

					<link href="${styleMainUri}" rel="stylesheet">

					<title>Base View Extension</title>
				</head>
				<body>
					<script>
						const vscode = acquireVsCodeApi();
					</script>

					<div id="app"></div>

					<script type="module" src="${scriptUri}"></script>
				</body>
			</html>`
	}
}
