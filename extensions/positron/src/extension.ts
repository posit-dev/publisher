// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const url = "127.0.0.1:9000";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('positron.publish.assistant.open', async () => {

		const terminal = vscode.window.createTerminal();
		terminal.show();
		terminal.sendText(`publisher publish-ui test/sample-content/fastapi-simple --listen=${url} --skip-browser-session-auth`);

		const panel = vscode.window.createWebviewPanel(
			'positron.publish.assistant',
			'Publish Assistant',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				enableForms: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, "out"),
					vscode.Uri.joinPath(context.extensionUri, "assets"),
				]
			}
		);

		const uri = await vscode.env.asExternalUri(vscode.Uri.parse(`http://${url}`));
		const cspsrc = panel.webview.cspSource;
		panel.webview.html =
		// install https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html to enable code highlighting below
		/*html*/
		`
		<!DOCTYPE html>
			<head>
				<meta
					http-equiv="Content-Security-Policy"
					content="default-src 'none'; frame-src ${uri} ${cspsrc} https:; img-src ${cspsrc} https:; script-src ${cspsrc}; style-src ${cspsrc};"
				/>
			</head>
			<body >
				<iframe src="${uri}">
			</body>
		</html>
		`;
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
