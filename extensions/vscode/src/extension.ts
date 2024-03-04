// Copyright (C) 2024 by Posit Software, PBC.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as ports from './ports';

import { Service } from './services';
import { ProjectTreeDataProvider } from './views/project';
import { DeploymentsTreeDataProvider } from './views/deployments';
import { ConfigurationsTreeDataProvider } from './views/configurations';
import { FilesTreeDataProvider } from './views/files';
import { DependenciesTreeDataProvider } from './views/dependencies';
import { CredentialsTreeDataProvider } from './views/credentials';
import { HelpAndFeedbackTreeDataProvider } from './views/helpAndFeedback';
import { LogsTreeDataProvider } from './views/logs';
import { EventStream } from './events';
import { Uri, commands, workspace } from 'vscode';

export type InitializeContent = 'indeterminate' | 'not-initialized' | 'initialized';

// Once the extension is activate, hang on to the service so that we can stop it on deactivation.
let service: Service;
const extensionName = 'posit.publisher';
const initializedContext = extensionName + '.initialized';

async function isExtensionInitialized() {
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    const firstWorkspaceURI = workspace.workspaceFolders[0].uri;
    const targetPath = Uri.joinPath(firstWorkspaceURI, '.posit/publish');

    try {
      await vscode.workspace.fs.stat(targetPath);
    } catch {
      return 'not-initialized';
    }
  }
  return 'initialized';
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

  commands.executeCommand('setContext', initializedContext, 'indeterminate');

  const port = await ports.acquire();
  service = new Service(context, port);
  await service.start();

  const initialized = await isExtensionInitialized();
  commands.executeCommand('setContext', initializedContext, initialized);

  context.subscriptions.push(
    vscode.commands.registerCommand('posit.publisher.initialize', async () => {
      commands.executeCommand('setContext', initializedContext, true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('posit.publisher.skipInitialization', async () => {
      commands.executeCommand('setContext', initializedContext, false);
    })
  );

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

  const stream = new EventStream(port);
  new ProjectTreeDataProvider().register(context);
  new DeploymentsTreeDataProvider(stream).register(context);
  new ConfigurationsTreeDataProvider().register(context);
  new FilesTreeDataProvider().register(context);
  new DependenciesTreeDataProvider().register(context);
  new CredentialsTreeDataProvider().register(context);
  new HelpAndFeedbackTreeDataProvider().register(context);
  new LogsTreeDataProvider(stream).register(context);
}

// This method is called when your extension is deactivated
export async function deactivate() {
  if (service) {
    await service.stop();
  }
}
