// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as assistants from './assistants';
import * as ports from './ports';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	let assistant = vscode.commands.registerCommand('positron.publish.assistant.open', async () => {
		const port = await ports.acquire();
		const path = vscode.workspace.workspaceFolders?.at(0)?.uri.path;
		if (path === undefined) {
			throw new Error("workspace path is undefined");
		}

		const assistant = assistants.create({
			port: port,
			resources: [
				vscode.Uri.joinPath(context.extensionUri, "out"),
				vscode.Uri.joinPath(context.extensionUri, "assets")
			],
			path: path
		});

		await assistant.start();
		await assistant.render();
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }
