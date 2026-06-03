// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";
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
 */
export function configureSnowflakeSDK(secrets: SecretStorage): void {
  snowflake.configure({
    customCredentialManager: new SnowflakeSecretStorageCredentialManager(
      secrets,
    ),
  });
}
