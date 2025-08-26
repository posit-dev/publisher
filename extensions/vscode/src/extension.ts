// Copyright (C) 2025 by Posit Software, PBC.

import {
  ExtensionContext,
  ExtensionMode,
  Uri,
  commands,
  workspace,
} from "vscode";

import * as ports from "src/ports";
import { Service } from "src/services";
import { ProjectTreeDataProvider } from "src/views/project";
import { LogsTreeDataProvider } from "src/views/logs";
import { EventStream } from "src/events";
import { HomeViewProvider } from "src/views/homeView";
import { WatcherManager } from "src/watchers";
import { Commands } from "src/constants";
import { DocumentTracker } from "./entrypointTracker";
import { getXDGConfigProperty } from "src/utils/config";
import { PublisherState } from "./state";
import { PublisherAuthProvider } from "./authProvider";
import { copySystemInfoCommand } from "src/commands";

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

const SELECTION_IS_CONNECT_CONTENT_RECORD_CONTEXT =
  "posit.publish.selection.isConnectContentRecord";
export enum SelectionIsConnectContentRecord {
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

export function setSelectionIsConnectContentRecord(
  context: SelectionIsConnectContentRecord,
) {
  commands.executeCommand(
    "setContext",
    SELECTION_IS_CONNECT_CONTENT_RECORD_CONTEXT,
    context,
  );
}

async function initializeExtension(context: ExtensionContext) {
  setStateContext(PositPublishState.uninitialized);
  setInitializationInProgressContext(InitializationInProgress.false);

  const useExternalAgent =
    context.extensionMode === ExtensionMode.Development &&
    process.env.POSIT_PUBLISHER_USE_EXTERNAL_AGENT === "TRUE";
  console.log(
    "Starting Context in extension mode: %s, with useExternalAgent set to %s",
    context.extensionMode,
    useExternalAgent,
  );

  let port = 9001;
  if (!useExternalAgent) {
    port = await ports.acquire();
  }

  const stream = new EventStream(port);
  context.subscriptions.push(stream);

  const useKeyChain = extensionSettings.useKeyChainCredentialStorage();

  service = new Service(context, port, useExternalAgent, useKeyChain);
  service.start();

  const watchers = new WatcherManager();
  context.subscriptions.push(watchers);

  const state = new PublisherState(context);

  // First the construction of the data providers
  const projectTreeDataProvider = new ProjectTreeDataProvider(context);

  const logsTreeDataProvider = new LogsTreeDataProvider(context, stream);

  const homeViewProvider = new HomeViewProvider(context, stream, state);
  context.subscriptions.push(homeViewProvider);

  // Then the registration of the data providers with the VSCode framework
  projectTreeDataProvider.register();
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
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  const now = new Date();
  console.log("Posit Publisher extension activated at %s", now.toString());
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
export async function deactivate() {
  console.log("Deactivating Posit Publisher extension");
  if (service) {
    await service.stop();
  }
}

export const extensionSettings = {
  verifyCertificates(): boolean {
    // get value from extension configuration - defaults to true
    const configuration = workspace.getConfiguration("positPublisher");
    const value: boolean | undefined =
      configuration.get<boolean>("verifyCertificates");
    return value !== undefined ? value : true;
  },
  useKeyChainCredentialStorage(): boolean {
    // get value from extension configuration - defaults to true
    const configuration = workspace.getConfiguration("positPublisher");
    const value: boolean | undefined = configuration.get<boolean>(
      "useKeyChainCredentialStorage",
    );
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
  enableConnectCloud(): boolean {
    // get value from extension configuration - defaults to false
    const configuration = workspace.getConfiguration("positPublisher");
    const value: boolean | undefined =
      configuration.get<boolean>("enableConnectCloud");
    return value !== undefined ? value : false;
  },
};
