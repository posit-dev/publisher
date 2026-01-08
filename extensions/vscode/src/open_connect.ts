// Copyright (C) 2026 by Posit Software, PBC.

import { Uri, commands } from "vscode";
import { Commands } from "src/constants";
import { useApi } from "./api";
import { authLogger } from "./authProvider";
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

// Validate a connect URI and drive the credential acquisition flow.
export async function handleConnectUri(uri: Uri) {
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
    pendingUri = uri;
    authLogger.debug(`Deferring URI handling until extension is initialized.`);
    return;
  }
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
    const response = await (
      await useApi()
    ).openConnectContent.openConnectContent(serverUrl, contentGuid);
    await commands.executeCommand(
      "vscode.openFolder",
      Uri.file(response.data.workspacePath),
      { forceReuseWindow: true },
    );
    authLogger.info(
      `Opened Connect content ${contentGuid} from ${serverUrl} at ${response.data.workspacePath}.`,
    );
  } catch (error) {
    authLogger.error(
      `Failed to open Connect content ${contentGuid} from ${serverUrl}: ${error}`,
    );
  }
}
