// Copyright (C) 2026 by Posit Software, PBC.

import { Uri, commands, window, workspace } from "vscode";
import { Commands } from "src/constants";
import { authLogger } from "./authProvider";
import {
  clearConnectContentBundle,
  connectContentUri,
} from "./connect_content_fs";
import { PublisherState } from "./state";

let publisherState: PublisherState | undefined;
let pendingUri: Uri | undefined;

// Canonicalize server URLs so credential matches are consistent.
function normalizeServerUrl(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

// Determine whether the current credential cache already covers a server.
function hasCredentialForServer(server: string, state: PublisherState) {
  return state.credentials.some(
    (credential) =>
      (normalizeServerUrl(credential.url) ?? credential.url) === server,
  );
}

// Attach the initialized state so URI handling can access credentials, and replay
// a URI that arrived before initialization completed.
//
// handleConnectUri can fire before the extension has finished initializing.
// In that case handleConnectUri defers processing until handleDeferredConnectUri is called
// by initializeExtension with the initialized PublisherState.
export function handleDeferredConnectUri(state: PublisherState) {
  publisherState = state;
  if (pendingUri) {
    handleConnectUri(pendingUri);
    pendingUri = undefined;
  }
}

// Provide a UI entrypoint to open Connect content by server URL and GUID.
export async function promptOpenConnectContent() {
  const serverUrl = await window.showInputBox({
    prompt: "Connect server URL",
    ignoreFocusOut: true,
  });
  if (!serverUrl) {
    return;
  }
  const contentGuid = await window.showInputBox({
    prompt: "Connect content GUID",
    ignoreFocusOut: true,
  });
  if (!contentGuid) {
    return;
  }
  await handleConnectUri(
    Uri.from({
      scheme: "vscode",
      authority: "posit.publisher",
      path: "/connect",
      query: `server=${encodeURIComponent(serverUrl)}&content=${encodeURIComponent(contentGuid)}`,
    }),
  );
}

// Validate a connect URI and drive the credential acquisition flow.
export async function handleConnectUri(uri: Uri) {
  authLogger.info(`handleConnectUri start for ${uri.toString()}`);
  if (uri.path !== "/connect") {
    authLogger.info(`Ignoring unsupported URI: ${uri.toString()}`);
    return;
  }
  const params = new URLSearchParams(uri.query);
  const server = params.get("server") ?? "";
  const content = params.get("content") ?? "";
  if (!server || !content) {
    authLogger.info(`Missing server/content in URI: ${uri.toString()}`);
    return;
  }
  const normalizedServer = normalizeServerUrl(server);
  if (!normalizedServer) {
    authLogger.info(`Invalid server URL in URI: ${server}`);
    return;
  }
  if (!publisherState) {
    authLogger.debug(
      `Extension not initialized yet. Deferring URI ${uri.toString()}`,
    );
    pendingUri = uri;
    authLogger.debug(`Deferring URI handling until extension is initialized.`);
    return;
  }
  authLogger.info(`Refreshing credentials before opening content.`);
  authLogger.info(`Refreshing credentials (first attempt).`);
  await publisherState.refreshCredentials();
  if (hasCredentialForServer(normalizedServer, publisherState)) {
    authLogger.info(
      `Found valid credentials for ${normalizedServer} (content ${content}).`,
    );
    await openConnectContent(normalizedServer, content);
    return;
  }
  authLogger.info(
    `No credentials for ${normalizedServer}. Opening credential flow.`,
  );
  await commands.executeCommand(
    Commands.HomeView.AddCredential,
    normalizedServer,
  );
  authLogger.info(`Refreshing credentials after credential flow.`);
  await publisherState.refreshCredentials();
  if (hasCredentialForServer(normalizedServer, publisherState)) {
    authLogger.info(
      `Valid credentials now available for ${normalizedServer} (content ${content}).`,
    );
    await openConnectContent(normalizedServer, content);
    return;
  }
  authLogger.info(
    `No valid credentials available for ${normalizedServer} (content ${content}).`,
  );
}

// Continue the workflow by fetching and opening the Connect content locally.
async function openConnectContent(serverUrl: string, contentGuid: string) {
  try {
    authLogger.info(
      `Opening Connect content ${contentGuid} on ${serverUrl}. Clearing any cached bundle.`,
    );
    clearConnectContentBundle(serverUrl, contentGuid);
    authLogger.info(
      `Executing open for connect-content workspace (server=${serverUrl} content=${contentGuid}).`,
    );
    const workspaceUri = connectContentUri(serverUrl, contentGuid);
    await openConnectContentInCurrentWindow(workspaceUri);
    authLogger.info(
      `Requested open folder for ${workspaceUri.toString()} and command resolved`,
    );
    authLogger.info(`Opened Connect content ${contentGuid} from ${serverUrl}.`);
  } catch (error) {
    authLogger.error(
      `Failed to open Connect content ${contentGuid} from ${serverUrl}: ${error}`,
    );
  }
}

async function openConnectContentInCurrentWindow(uri: Uri) {
  const workspaceFolders = workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    authLogger.info(
      "No workspace folders open; falling back to vscode.openFolder",
    );
    await commands.executeCommand("vscode.openFolder", uri, {
      forceReuseWindow: true,
      forceNewWindow: false,
    });
    return;
  }
  authLogger.info(
    "Replacing current workspace folders with connect-content workspace",
  );
  const replacements = workspace.updateWorkspaceFolders(
    0,
    workspaceFolders.length,
    { uri },
  );
  if (!replacements) {
    authLogger.info(
      "updateWorkspaceFolders failed; falling back to vscode.openFolder",
    );
    await commands.executeCommand("vscode.openFolder", uri, {
      forceReuseWindow: true,
      forceNewWindow: false,
    });
  }
}
