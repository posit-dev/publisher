// Copyright (C) 2026 by Posit Software, PBC.

import { Uri, commands, window, workspace } from "vscode";
import { authLogger } from "./authProvider";
import {
  clearConnectContentBundle,
  connectContentUri,
  normalizeServerUrl,
} from "./connect_content_fs";

// Provide a UI entrypoint to open Connect content by server URL and GUID.
export async function promptOpenConnectContent() {
  const serverUrlInput = await window.showInputBox({
    prompt: "Connect server URL",
    ignoreFocusOut: true,
  });
  if (!serverUrlInput) {
    return;
  }
  const serverUrl = normalizeServerUrl(serverUrlInput);
  if (!serverUrl) {
    authLogger.error(`Invalid server URL: ${serverUrlInput}`);
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
  const normalizedServer = normalizeServerUrl(server);
  if (!server || !content || !normalizedServer) {
    authLogger.error(
      `Missing or invalid server/content in URI: ${uri.toString()}`,
    );
    return;
  }
  await openConnectContent(normalizedServer, content);
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
