// Copyright (C) 2024 by Posit Software, PBC.

import { ExtensionContext, commands, workspace } from "vscode";

import * as ports from "src/ports";
import { Service } from "src/services";
import { ProjectTreeDataProvider } from "src/views/project";
import { DeploymentsTreeDataProvider } from "src/views/deployments";
import { ConfigurationsTreeDataProvider } from "src/views/configurations";
import { CredentialsTreeDataProvider } from "src/views/credentials";
import { HelpAndFeedbackTreeDataProvider } from "src/views/helpAndFeedback";
import { LogsTreeDataProvider } from "src/views/logs";
import { EventStream } from "src/events";
import { HomeViewProvider } from "src/views/homeView";
import { WatcherManager } from "./watchers";

const STATE_CONTEXT = "posit.publish.state";

enum PositPublishState {
  initialized = "initialized",
  uninitialized = "uninitialized",
}

const INITIALIZING_CONTEXT = "posit.publish.initialization.inProgress";
const INIT_PROJECT_COMMAND = "posit.publisher.init-project";
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
  setStateContext(PositPublishState.uninitialized);
  setInitializationInProgressContext(InitializationInProgress.false);

  const port = await ports.acquire();
  const stream = new EventStream(port);
  context.subscriptions.push(stream);

  service = new Service(context, port);

  const watchers = new WatcherManager(workspace.workspaceFolders?.[0]);
  context.subscriptions.push(watchers);

  // First the construction of the data providers
  const projectTreeDataProvider = new ProjectTreeDataProvider(context);

  const deploymentsTreeDataProvider = new DeploymentsTreeDataProvider(
    context,
    stream,
  );

  const configurationsTreeDataProvider = new ConfigurationsTreeDataProvider(
    context,
  );

  const credentialsTreeDataProvider = new CredentialsTreeDataProvider(context);

  const helpAndFeedbackTreeDataProvider = new HelpAndFeedbackTreeDataProvider(
    context,
  );

  const logsTreeDataProvider = new LogsTreeDataProvider(context, stream);

  const homeViewProvider = new HomeViewProvider(context, stream);

  // Then the registration of the data providers with the VSCode framework
  projectTreeDataProvider.register();
  deploymentsTreeDataProvider.register(watchers);
  configurationsTreeDataProvider.register(watchers);
  credentialsTreeDataProvider.register();
  helpAndFeedbackTreeDataProvider.register();
  logsTreeDataProvider.register();
  homeViewProvider.register(watchers);

  await service.start();

  context.subscriptions.push(
    commands.registerCommand(INIT_PROJECT_COMMAND, async (viewId?: string) => {
      setInitializationInProgressContext(InitializationInProgress.true);
      await homeViewProvider.showNewDestinationMultiStep(viewId);
      setInitializationInProgressContext(InitializationInProgress.false);
    }),
  );

  setStateContext(PositPublishState.initialized);
}

// This method is called when your extension is deactivated
export async function deactivate() {
  if (service) {
    await service.stop();
  }
}
