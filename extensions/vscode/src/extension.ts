// Copyright (C) 2024 by Posit Software, PBC.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import * as ports from "./ports";
import { Service } from "./services";
import { ProjectTreeDataProvider } from "./views/project";
import { DeploymentsTreeDataProvider } from "./views/deployments";
import { ConfigurationsTreeDataProvider } from "./views/configurations";
import { FilesTreeDataProvider } from "./views/files";
import { RequirementsTreeDataProvider } from "./views/requirements";
import { CredentialsTreeDataProvider } from "./views/credentials";
import { HelpAndFeedbackTreeDataProvider } from "./views/helpAndFeedback";
import { LogsTreeDataProvider } from "./views/logs";
import { EventStream } from "./events";
import { HomeViewProvider } from "./views/homeView";
import { commands } from "vscode";

const STATE_CONTEXT = "posit.publish.state";
const MISSING_CONTEXT = "posit.publish.missing";

enum PositPublishState {
  initialized = "initialized",
  uninitialized = "uninitialized",
}

// Once the extension is activate, hang on to the service so that we can stop it on deactivation.
let service: Service;

async function isMissingPublishDirs(
  folder: vscode.WorkspaceFolder,
): Promise<boolean> {
  try {
    const stats = await Promise.all([
      vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, ".posit")),
      vscode.workspace.fs.stat(
        vscode.Uri.joinPath(folder.uri, ".posit/publish"),
      ),
    ]);

    return !stats.every((stat) => stat.type === vscode.FileType.Directory);
  } catch {
    return true;
  }
}

function setMissingContext(context: boolean) {
  vscode.commands.executeCommand("setContext", MISSING_CONTEXT, context);
}

function setStateContext(context: PositPublishState) {
  vscode.commands.executeCommand("setContext", STATE_CONTEXT, context);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  setStateContext(PositPublishState.uninitialized);

  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length
  ) {
    const folder = vscode.workspace.workspaceFolders[0];

    console.log(
      `publisher: Creating watcher for ${folder.uri} .posit,.posit/publish`,
    );
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, "{.posit,.posit/publish}"),
      false,
      true,
      false,
    );
    watcher.onDidCreate(async () => {
      console.log("publisher: FS create event");
      setMissingContext(await isMissingPublishDirs(folder));
    });
    watcher.onDidDelete(() => {
      console.log("publisher: FS delete event");
      setMissingContext(true);
    });
    context.subscriptions.push(watcher);

    // set our initial mode
    commands.executeCommand(
      "setContext",
      "posit.publisher.homeView.deploymentActiveMode",
      "basic-mode",
    );
  } else {
    setMissingContext(true);
  }

  const port = await ports.acquire();
  const stream = new EventStream(port);
  context.subscriptions.push(stream);

  service = new Service(context, port);
  const apiReady = service.isUp();

  new ProjectTreeDataProvider(context).register();
  new DeploymentsTreeDataProvider(context, stream, apiReady).register();
  new ConfigurationsTreeDataProvider(context, apiReady).register();
  new FilesTreeDataProvider(context, apiReady).register();
  new RequirementsTreeDataProvider(context, apiReady).register();
  new CredentialsTreeDataProvider(context, apiReady).register();
  new HelpAndFeedbackTreeDataProvider(context).register();
  new LogsTreeDataProvider(context, stream).register();
  new HomeViewProvider(context, stream).register();

  await service.start();

  setStateContext(PositPublishState.initialized);
}

// This method is called when your extension is deactivated
export async function deactivate() {
  if (service) {
    await service.stop();
  }
}
