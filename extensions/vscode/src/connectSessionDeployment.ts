// Copyright (C) 2026 by Posit Software, PBC.

import { ConnectAPI, ContentID } from "@posit-dev/connect-api";
import { window } from "vscode";
import { normalizeServerURL } from "./utils/serverUrl";
import { getMessageFromError } from "./utils/errors";

/** CONNECT_CONTENT_GUID continues to identify the running project, not its source. */
export function isConnectSessionTarget(
  serverUrl: string,
  contentId: string | undefined,
): boolean {
  const server = process.env.CONNECT_SERVER;
  const target = process.env.CONNECT_DEPLOY_TARGET_GUID;
  if (
    process.env.POSIT_PRODUCT !== "CONNECT" ||
    !target ||
    contentId !== target
  ) {
    return false;
  }
  if (!server) {
    return true;
  }
  try {
    return normalizeServerURL(serverUrl) === normalizeServerURL(server);
  } catch {
    return true;
  }
}

/** Fetch the linked source title for display without changing Publisher config. */
export async function fetchConnectSessionTitle(
  api: ConnectAPI,
  contentId: string,
): Promise<string | undefined> {
  const { data } = await api.contentDetails(ContentID(contentId));
  return data.title || data.name || undefined;
}

/** Check access and report when the linked source changed since initialization. */
export async function validateConnectSessionDeploy(
  api: ConnectAPI,
  contentId: string,
): Promise<boolean> {
  let content;
  try {
    ({ data: content } = await api.contentDetails(ContentID(contentId)));
  } catch (error: unknown) {
    await window.showErrorMessage(
      `Unable to access the linked source (${contentId}). Check your sign-in and ask the source owner for editor access. ${getMessageFromError(error)}`,
    );
    return false;
  }
  const title = content.title || content.name || contentId;
  if (content.app_role !== "owner" && content.app_role !== "editor") {
    await window.showErrorMessage(
      `You must be an owner or editor to redeploy the linked source "${title}". Sign in with a credential that has deployment access.`,
    );
    return false;
  }
  if (content.locked) {
    await window.showErrorMessage(
      `The linked source "${title}" is locked and cannot be redeployed.`,
    );
    return false;
  }
  const baseBundle = process.env.CONNECT_DEPLOY_TARGET_BUNDLE_ID;
  if (!baseBundle) {
    void window.showWarningMessage(
      `The source bundle ID was unavailable when this project started. Deploying to "${title}" may overwrite changes made since then.`,
    );
  } else if (baseBundle !== content.bundle_id) {
    void window.showWarningMessage(
      `The source has changed since this project was created. Deploying to "${title}" may overwrite those changes.`,
    );
  }
  return true;
}
