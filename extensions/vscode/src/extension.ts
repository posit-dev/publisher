// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as ports from './ports';
import  { Service } from './services';
import { SimpleTreeDataProvider } from './windows/providers';

// Once the extension is activate, hang on to the service so that we can stop it on deactivation.
let service: Service;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	const port = await ports.acquire();
	service = new Service(context, port);
	await service.start();

	context.subscriptions.push(
		vscode.commands.registerCommand('posit.publisher.open', async () => {
			await service.open();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('posit.publisher.close', async () => {
			await service.stop();
		})
	);


	// Configurations
	vscode.window.registerTreeDataProvider("posit.publisher.configurations.provider", new SimpleTreeDataProvider(port));
	context.subscriptions.push(
		vscode.commands.registerCommand('posit.publisher.configurations.view', async () => {
			// todo - replace this with a call open the specific page for the configuration
			await service.open();
		})
	);


	// Deployments
	vscode.window.registerTreeDataProvider("posit.publisher.deployments.provider", new SimpleTreeDataProvider(port));
	context.subscriptions.push(
		vscode.commands.registerCommand('posit.publisher.deployments.view', async () => {
			// todo - replace this with a call open the specific page for the deployment
			await service.open();
		})
	);
}

// This method is called when your extension is deactivated
export async function deactivate() {
	if (service) {
		await service.stop();
	}
}
