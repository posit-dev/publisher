// Copyright (C) 2025 by Posit Software, PBC.

import { SecretStorage } from "vscode";

import { CredentialsService } from "./credentialsService";
import { FileCredentialsService } from "./fileCredentials";

// Re-export types and interfaces
export type { CredentialsService } from "./credentialsService";
export { FileCredentialsService } from "./fileCredentials";
export { SecretStorageCredentialsService } from "./secretStorageCredentials";
export type {
  Credential,
  CreateCredentialDetails,
  CredentialRecord,
  FileCredential,
  FileCredentials,
} from "./types";
export { CURRENT_VERSION, SERVICE_NAME } from "./types";
export {
  NotFoundError,
  LoadError,
  CorruptedError,
  VersionError,
  IdentityCollisionError,
  NameCollisionError,
  IncompleteCredentialError,
  BackupError,
  isNotFoundError,
  isLoadError,
  isCorruptedError,
  isVersionError,
  isIdentityCollisionError,
  isNameCollisionError,
  isIncompleteCredentialError,
  isBackupError,
} from "./errors";

/**
 * Creates a credentials service based on the configuration.
 *
 * NOTE: Currently always uses file-based storage (~/.connect-credentials) because:
 * - The Go backend stores credentials in the system keyring (via go-keyring)
 * - VS Code's SecretStorage is a separate storage mechanism
 * - File-based storage is the only format shared between Go and TypeScript
 *
 * Future work: Migrate credentials from system keyring to VS Code SecretStorage,
 * then update both Go and TypeScript to use the new storage.
 *
 * @param _secrets - VS Code's SecretStorage API (currently unused)
 * @param _useSecretStorage - Whether to prefer SecretStorage (currently unused)
 * @returns A CredentialsService instance
 */
export async function createCredentialsService(
  _secrets: SecretStorage | undefined,
  _useSecretStorage: boolean,
): Promise<CredentialsService> {
  // Always use file-based storage for now since it's shared with Go backend
  // The Go backend uses system keyring (go-keyring) which is different from
  // VS Code's SecretStorage, so we can't read those credentials directly.
  const fileService = new FileCredentialsService();
  await fileService.setup();
  return fileService;
}
