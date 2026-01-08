// Copyright (C) 2026 by Posit Software, PBC.

import { Uri, commands } from "vscode";
import { Commands } from "src/constants";
import { authLogger } from "./authProvider";
import { PublisherState } from "./state";

let publisherState: PublisherState | undefined;
let pendingUri: Uri | undefined;

function normalizeServerUrl(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function hasCredentialForServer(server: string, state: PublisherState) {
  return state.credentials.some(
    (credential) =>
      (normalizeServerUrl(credential.url) ?? credential.url) === server,
  );
}

export function setOpenConnectState(state: PublisherState) {
  publisherState = state;
  if (pendingUri) {
    handleConnectUri(pendingUri);
    pendingUri = undefined;
  }
}

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
    authLogger.info(`Deferring URI handling until extension is initialized.`);
    return;
  }
  await publisherState.refreshCredentials();
  if (hasCredentialForServer(normalizedServer, publisherState)) {
    authLogger.info(
      `Found valid credentials for ${normalizedServer} (content ${content}).`,
    );
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
    return;
  }
  authLogger.info(
    `No valid credentials available for ${normalizedServer} (content ${content}).`,
  );
}
