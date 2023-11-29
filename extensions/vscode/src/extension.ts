// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import  { Service } from './services';

// Once the extension is activate, hang on to the service so that we can stop it on deactivation.
let service: Service;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	service = await Service.get(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('posit.publisher.assistant.start', async () => {
			await service.start();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('posit.publisher.assistant.stop', async () => {
			await service.stop();
		})
	);
}

// This method is called when your extension is deactivated
export async function deactivate() {
	if (service) {
		await service.stop();
	}
}
