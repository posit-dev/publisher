// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('positron.publish.assistant.open', async () => {
		const terminal = vscode.window.createTerminal();
		terminal.show();
		terminal.sendText(`just run publish-ui test/sample-content/fastapi-simple --listen=127.0.0.1:9000 --skip-browser-session-auth`);
		const uri = vscode.Uri.parse(`http://localhost:9000`, true);
		const url = await vscode.env.asExternalUri(uri);

		const panel = vscode.window.createWebviewPanel(
			'positron.publish.assistant',
			'Poistron Publish Assistant',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
			}
		);


		const styles = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "assets", "index.css"));
		const scripts = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "assets", "index.js"));
		const nonce = getNonce();

		panel.webview.html =
			// install https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html to enable code highlighting below
			/*html*/
			`
			<!DOCTYPE html>
			  <html lang="en">
				<head>
				  <meta charset="UTF-8" />
				  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
				  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';">
				  <link rel="stylesheet" type="text/css" href="${styles}">
				  <title>Hello World</title>
				</head>
				<body>
				  <div id="app"></div>
				  <script type="module" nonce="${nonce}" src="${scripts}"></script>
				</body>
			  </html>
		`;
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }


const getNonce = (): string => {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
