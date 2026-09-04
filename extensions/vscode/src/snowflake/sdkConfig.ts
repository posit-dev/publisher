// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";

import { SecretStorage, Uri } from "vscode";
import snowflake from "snowflake-sdk";

import { SnowflakeSecretStorageCredentialManager } from "./secretStorageCredentialManager";

/**
 * Installs process-global snowflake-sdk configuration. This mutates singleton
 * state inside snowflake-sdk, so it must be called exactly once during
 * extension activation — not per object construction — and owned by the code
 * that sets up the process, not by consumers of the SDK.
 *
 * Wires the SDK's credential cache (used for the externalbrowser SSO id-token)
 * to the extension's SecretStorage so cached tokens are persisted securely.
 *
 * Also pins the SDK's log file to `logDir`. The SDK logs to `snowflake.log`
 * relative to the working directory, which on Linux is the user's home
 * directory, so the first log write drops a `snowflake.log` there. Winston
 * creates the directory as needed, so `logDir` need not exist yet.
 */
export function configureSnowflakeSDK(
  secrets: SecretStorage,
  logDir: Uri,
): void {
  snowflake.configure({
    customCredentialManager: new SnowflakeSecretStorageCredentialManager(
      secrets,
    ),
    logFilePath: path.join(logDir.fsPath, "snowflake.log"),
  });
}
