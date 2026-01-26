// Copyright (C) 2026 by Posit Software, PBC.

import { Uri, commands, window, workspace } from "vscode";
import { logger } from "./logging";
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
    logger.error(`Invalid server URL: ${serverUrlInput}`);
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

// Validate a connect URI and open the content in the current window.
export async function handleConnectUri(uri: Uri) {
  logger.info(`handleConnectUri start for ${uri.toString()}`);
  if (uri.path !== "/connect") {
    logger.info(`Ignoring unsupported URI: ${uri.toString()}`);
    return;
  }
  const params = new URLSearchParams(uri.query);
  const server = params.get("server") ?? "";
  const content = params.get("content") ?? "";
  const normalizedServer = normalizeServerUrl(server);
  if (!server || !content || !normalizedServer) {
    logger.error(
      `Missing or invalid server/content in URI: ${uri.toString()}`,
    );
    return;
  }

  try {
    logger.info(
      `Opening Connect content ${content} on ${normalizedServer}. Clearing any cached bundle.`,
    );
    clearConnectContentBundle(normalizedServer, content);
    const workspaceUri = connectContentUri(normalizedServer, content);

    const workspaceFolders = workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
      logger.info("No workspace folders open; using vscode.openFolder");
      await commands.executeCommand("vscode.openFolder", workspaceUri, {
        forceReuseWindow: true,
        forceNewWindow: false,
      });
    } else {
      logger.info(
        "Replacing current workspace folders with connect-content workspace",
      );
      const success = workspace.updateWorkspaceFolders(
        0,
        workspaceFolders.length,
        { uri: workspaceUri },
      );
      if (!success) {
        logger.info(
          "updateWorkspaceFolders failed; falling back to vscode.openFolder",
        );
        await commands.executeCommand("vscode.openFolder", workspaceUri, {
          forceReuseWindow: true,
          forceNewWindow: false,
        });
      }
    }
    logger.info(
      `Opened Connect content ${content} from ${normalizedServer}.`,
    );
  } catch (error) {
    logger.error(
      `Failed to open Connect content ${content} from ${normalizedServer}: ${error}`,
    );
  }
}
