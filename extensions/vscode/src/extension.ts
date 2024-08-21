// Copyright (C) 2024 by Posit Software, PBC.

import { ExtensionContext, Uri, commands } from "vscode";

import * as ports from "src/ports";
import { Service } from "src/services";
import { ProjectTreeDataProvider } from "src/views/project";
import { CredentialsTreeDataProvider } from "src/views/credentials";
import { LogsTreeDataProvider } from "src/views/logs";
import { EventStream } from "src/events";
import { HomeViewProvider } from "src/views/homeView";
import { WatcherManager } from "src/watchers";
import { Commands } from "src/constants";
import { DocumentTracker } from "./entrypointTracker";

const STATE_CONTEXT = "posit.publish.state";

enum PositPublishState {
  initialized = "initialized",
  uninitialized = "uninitialized",
}

const INITIALIZING_CONTEXT = "posit.publish.initialization.inProgress";
enum InitializationInProgress {
  true = "true",
  false = "false",
}

// Once the extension is activate, hang on to the service so that we can stop it on deactivation.
let service: Service;

function setStateContext(context: PositPublishState) {
  commands.executeCommand("setContext", STATE_CONTEXT, context);
}

function setInitializationInProgressContext(context: InitializationInProgress) {
  commands.executeCommand("setContext", INITIALIZING_CONTEXT, context);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
  console.log("Activating Posit Publisher extension");
  setStateContext(PositPublishState.uninitialized);
  setInitializationInProgressContext(InitializationInProgress.false);

  const port = await ports.acquire();
  const stream = new EventStream(port);
  context.subscriptions.push(stream);

  service = new Service(context, port);
  service.start();

  const watchers = new WatcherManager();
  context.subscriptions.push(watchers);

  // First the construction of the data providers
  const projectTreeDataProvider = new ProjectTreeDataProvider(context);

  const credentialsTreeDataProvider = new CredentialsTreeDataProvider(context);

  const logsTreeDataProvider = new LogsTreeDataProvider(context, stream);

  const homeViewProvider = new HomeViewProvider(context, stream);
  context.subscriptions.push(homeViewProvider);

  // Then the registration of the data providers with the VSCode framework
  projectTreeDataProvider.register();
  credentialsTreeDataProvider.register();
  logsTreeDataProvider.register();
  homeViewProvider.register(watchers);

  context.subscriptions.push(
    commands.registerCommand(Commands.InitProject, async (viewId: string) => {
      setInitializationInProgressContext(InitializationInProgress.true);
      await homeViewProvider.showNewDeploymentMultiStep(viewId);
      setInitializationInProgressContext(InitializationInProgress.false);
    }),
    commands.registerCommand(Commands.ShowOutputChannel, () =>
      service.showOutputChannel(),
    ),
    commands.registerCommand(Commands.ShowPublishingLog, () =>
      commands.executeCommand(Commands.Logs.Focus),
    ),
  );
  setStateContext(PositPublishState.initialized);

  context.subscriptions.push(
    new DocumentTracker(),
    commands.registerCommand(Commands.DeployWithEntrypoint, (uri: Uri) => {
      commands.executeCommand(Commands.HomeView.Focus);
      homeViewProvider.handleFileInitiatedDeployment(uri);
    }),
  );
}

// This method is called when your extension is deactivated
export async function deactivate() {
  console.log("Deactivating Posit Publisher extension");
  if (service) {
    await service.stop();
  }
}
