// Copyright (C) 2025 by Posit Software, PBC.

import { ExtensionContext, Uri, commands, window, workspace } from "vscode";

import { ProjectTreeDataProvider } from "src/views/project";
import { LogsTreeDataProvider, LogsViewProvider } from "src/views/logs";
import { EventStream } from "src/events";
import { HomeViewProvider } from "src/views/homeView";
import { WatcherManager } from "src/watchers";
import { Commands } from "src/constants";
import { DocumentTracker } from "./entrypointTracker";
import { getXDGConfigProperty } from "src/utils/config";
import { PublisherState } from "./state";
import { PublisherAuthProvider } from "./authProvider";
import { logger } from "./logging";
import { copySystemInfoCommand } from "src/commands";
import { registerLLMTooling } from "./llm";
import {
  clearConnectContentBundleForUri,
  registerConnectContentFileSystem,
} from "./connect_content_fs";
import { handleConnectUri, promptOpenConnectContent } from "./open_connect";

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

const SELECTION_HAS_CREDENTIAL_MATCH_CONTEXT =
  "posit.publish.selection.hasCredentialMatch";
export enum SelectionCredentialMatch {
  true = "true",
  false = "false",
}

const SELECTION_IS_PRE_CONTENT_RECORD_CONTEXT =
  "posit.publish.selection.isPreContentRecord";
export enum SelectionIsPreContentRecord {
  true = "true",
  false = "false",
}

let resolvePublisherState: (state: PublisherState) => void;
const publisherStateReady = new Promise<PublisherState>((resolve) => {
  resolvePublisherState = resolve;
});

function setStateContext(context: PositPublishState) {
  commands.executeCommand("setContext", STATE_CONTEXT, context);
}

function setInitializationInProgressContext(context: InitializationInProgress) {
  commands.executeCommand("setContext", INITIALIZING_CONTEXT, context);
}

export function setSelectionHasCredentialMatch(
  context: SelectionCredentialMatch,
) {
  commands.executeCommand(
    "setContext",
    SELECTION_HAS_CREDENTIAL_MATCH_CONTEXT,
    context,
  );
}

export function setSelectionIsPreContentRecord(
  context: SelectionIsPreContentRecord,
) {
  commands.executeCommand(
    "setContext",
    SELECTION_IS_PRE_CONTENT_RECORD_CONTEXT,
    context,
  );
}

function initializeExtension(context: ExtensionContext) {
  setStateContext(PositPublishState.uninitialized);
  setInitializationInProgressContext(InitializationInProgress.false);

  const stream = new EventStream();
  context.subscriptions.push(stream);

  const watchers = new WatcherManager();
  context.subscriptions.push(watchers);

  const state = new PublisherState(context);
  resolvePublisherState(state);

  // First the construction of the data providers
  const projectTreeDataProvider = new ProjectTreeDataProvider(context);

  // Logs tree view
  const logsTreeDataProvider = new LogsTreeDataProvider(context, stream);

  const homeViewProvider = new HomeViewProvider(context, stream, state);
  context.subscriptions.push(homeViewProvider);

  // Logs web view
  const logsViewProvider = new LogsViewProvider(stream);

  // Then the registration of the data providers with the VSCode framework
  projectTreeDataProvider.register();
  logsTreeDataProvider.register();
  homeViewProvider.register(watchers);
  logsViewProvider.register();

  context.subscriptions.push(
    commands.registerCommand(
      Commands.Logs.Fileview,
      LogsViewProvider.openRawLogFileView,
    ),
    commands.registerCommand(Commands.Logs.Copy, LogsViewProvider.copyLogs),
    commands.registerCommand(Commands.InitProject, async (viewId: string) => {
      setInitializationInProgressContext(InitializationInProgress.true);
      await homeViewProvider.showNewDeploymentMultiStep(viewId);
      setInitializationInProgressContext(InitializationInProgress.false);
    }),
    commands.registerCommand(Commands.ShowOutputChannel, () => logger.show()),
    commands.registerCommand(Commands.ShowPublishingLog, () => {
      commands.executeCommand(Commands.Logs.Focus);
    }),
    commands.registerCommand(Commands.OpenConnectContent, () =>
      promptOpenConnectContent(),
    ),
    commands.registerCommand(Commands.HomeView.CopySystemInfo, () =>
      copySystemInfoCommand(context),
    ),
  );
  setStateContext(PositPublishState.initialized);

  context.subscriptions.push(
    new DocumentTracker(),
    commands.registerCommand(Commands.DeployWithEntrypoint, (uri: Uri) => {
      commands.executeCommand(Commands.HomeView.Focus);
      homeViewProvider.handleFileInitiatedDeploymentSelection(uri);
    }),
  );

  context.subscriptions.push(new PublisherAuthProvider(state));
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders((event) => {
      event.removed.forEach((folder) => {
        clearConnectContentBundleForUri(folder.uri);
      });
    }),
  );

  // Register LLM Tools under /llm
  registerLLMTooling(context, state);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  const now = new Date();
  console.log("Posit Publisher extension activated at %s", now.toString());
  context.subscriptions.push(
    registerConnectContentFileSystem(publisherStateReady),
  );
  context.subscriptions.push(
    window.registerUriHandler({
      handleUri(uri: Uri) {
        logger.info(`Handling URI: ${uri.toString()}`);
        handleConnectUri(uri);
      },
    }),
  );

  // Is our workspace trusted?
  if (workspace.isTrusted) {
    console.log("initializing extension within a trusted workspace");
    initializeExtension(context);
    return;
  }
  console.log(
    "activated within a restricted workspace. Initialization is paused until trust is granted.",
  );

  // We are not trusted yet... so if and when we are, then start the initialization
  context.subscriptions.push(
    workspace.onDidGrantWorkspaceTrust(() => {
      console.log("Trust mode granted by user.");
      console.log(
        "Proceeding forward with initializion for extension within a trusted workspace",
      );
      initializeExtension(context);
    }),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Deactivating Posit Publisher extension");
}

export const extensionSettings = {
  verifyCertificates(): boolean {
    // get value from extension configuration - defaults to true
    const configuration = workspace.getConfiguration("positPublisher");
    const value: boolean | undefined =
      configuration.get<boolean>("verifyCertificates");
    return value !== undefined ? value : true;
  },
  async defaultConnectServer(): Promise<string> {
    const configuration = workspace.getConfiguration("positPublisher");
    let value: string | undefined = configuration.get<string>(
      "defaultConnectServer",
    );

    // For RStudio and Posit Workbench users, look here as a final step
    if (value === undefined || value === "") {
      const configURL: string | null = await getXDGConfigProperty(
        "rstudio/rsession.conf",
        "default-rsconnect-server",
      );
      if (configURL !== null) value = configURL;
    }
    return value !== undefined ? value : "";
  },
  autoOpenLogsOnFailure(): boolean {
    // get value from extension configuration - defaults to true
    const configuration = workspace.getConfiguration("positPublisher");
    const value: boolean | undefined = configuration.get<boolean>(
      "autoOpenLogsOnFailure",
    );
    return value !== undefined ? value : true;
  },
  enableConnectCloud(): boolean {
    const configuration = workspace.getConfiguration("positPublisher");
    const value: boolean | undefined =
      configuration.get<boolean>("enableConnectCloud");
    return value !== undefined ? value : true;
  },
};
