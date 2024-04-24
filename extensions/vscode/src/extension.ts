// Copyright (C) 2024 by Posit Software, PBC.

import * as ports from "./ports";
import { useApi } from "./api";
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
import {
  ExtensionContext,
  FileType,
  RelativePattern,
  Uri,
  WorkspaceFolder,
  commands,
  window,
  workspace,
} from "vscode";
import { initWorkspaceWithFixedNames } from "./multiStepInputs/initWorkspace";
import { getSummaryStringFromError } from "./utils/errors";

const STATE_CONTEXT = "posit.publish.state";
const MISSING_CONTEXT = "posit.publish.missing";

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

const CREDENTIAL_CHECK = "posit.publish.initialization.credentialCheck";
const REFRESH_INIT_PROJECT_COMMAND = "posit.publisher.init-project.refresh";
enum PositPublishCredentialCheck {
  inProgress = "inProgress",
  failed = "failed",
  succeeded = "succeeded",
}

// Once the extension is activate, hang on to the service so that we can stop it on deactivation.
let service: Service;

async function isMissingPublishDirs(folder: WorkspaceFolder): Promise<boolean> {
  try {
    const stats = await Promise.all([
      workspace.fs.stat(Uri.joinPath(folder.uri, ".posit")),
      workspace.fs.stat(Uri.joinPath(folder.uri, ".posit/publish")),
    ]);

    return !stats.every((stat) => stat.type === FileType.Directory);
  } catch {
    return true;
  }
}

async function checkForCredentials() {
  try {
    const api = await useApi();
    const response = await api.accounts.getAll();
    if (response.data.length) {
      setCredentialCheckContext(PositPublishCredentialCheck.succeeded);
    } else {
      setCredentialCheckContext(PositPublishCredentialCheck.failed);
    }
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "extension::checkForCredentials",
      error,
    );
    window.showInformationMessage(summary);
  }
}

function setMissingContext(context: boolean) {
  commands.executeCommand("setContext", MISSING_CONTEXT, context);
}

function setStateContext(context: PositPublishState) {
  commands.executeCommand("setContext", STATE_CONTEXT, context);
}

function setInitializationInProgressContext(context: InitializationInProgress) {
  commands.executeCommand("setContext", INITIALIZING_CONTEXT, context);
}

function setCredentialCheckContext(context: PositPublishCredentialCheck) {
  commands.executeCommand("setContext", CREDENTIAL_CHECK, context);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
  setStateContext(PositPublishState.uninitialized);
  setCredentialCheckContext(PositPublishCredentialCheck.inProgress);
  setInitializationInProgressContext(InitializationInProgress.false);

  if (workspace.workspaceFolders && workspace.workspaceFolders.length) {
    const folder = workspace.workspaceFolders[0];

    const watcher = workspace.createFileSystemWatcher(
      new RelativePattern(folder, "{.posit,.posit/publish}"),
      false,
      true,
      false,
    );
    watcher.onDidCreate(async () => {
      setMissingContext(await isMissingPublishDirs(folder));
    });
    watcher.onDidDelete(() => {
      setMissingContext(true);
    });
    context.subscriptions.push(watcher);

    setMissingContext(await isMissingPublishDirs(folder));
  } else {
    setMissingContext(true);
  }

  const port = await ports.acquire();
  const stream = new EventStream(port);
  context.subscriptions.push(stream);

  service = new Service(context, port);
  checkForCredentials();

  // First the construction of the data providers
  const projectTreeDataProvider = new ProjectTreeDataProvider(context);

  const deploymentsTreeDataProvider = new DeploymentsTreeDataProvider(
    context,
    stream,
  );

  const configurationsTreeDataProvider = new ConfigurationsTreeDataProvider(
    context,
  );

  const filesTreeDataProvider = new FilesTreeDataProvider(context);

  const requirementsTreeDataProvider = new RequirementsTreeDataProvider(
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
  deploymentsTreeDataProvider.register();
  configurationsTreeDataProvider.register();
  filesTreeDataProvider.register();
  requirementsTreeDataProvider.register();
  credentialsTreeDataProvider.register();
  helpAndFeedbackTreeDataProvider.register();
  logsTreeDataProvider.register();
  homeViewProvider.register();

  await service.start();

  context.subscriptions.push(
    commands.registerCommand(INIT_PROJECT_COMMAND, async (viewId?: string) => {
      setInitializationInProgressContext(InitializationInProgress.true);
      await initWorkspaceWithFixedNames(viewId);
      setInitializationInProgressContext(InitializationInProgress.false);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(REFRESH_INIT_PROJECT_COMMAND, () =>
      checkForCredentials(),
    ),
  );

  setStateContext(PositPublishState.initialized);
}

// This method is called when your extension is deactivated
export async function deactivate() {
  if (service) {
    await service.stop();
  }
}
