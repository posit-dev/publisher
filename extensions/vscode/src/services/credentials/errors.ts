// Copyright (C) 2025 by Posit Software, PBC.

/**
 * Error thrown when a credential is not found.
 */
export class NotFoundError extends Error {
  readonly guid: string;

  constructor(guid: string) {
    super(`credential not found: ${guid}`);
    this.name = "NotFoundError";
    this.guid = guid;
  }
}

/**
 * Error thrown when credentials fail to load.
 */
export class LoadError extends Error {
  readonly cause: Error;

  constructor(cause: Error) {
    super(`failed to load credentials: ${cause.message}`);
    this.name = "LoadError";
    this.cause = cause;
  }
}

/**
 * Error thrown when a credential is corrupted or cannot be parsed.
 */
export class CorruptedError extends Error {
  readonly guid: string;

  constructor(guid: string) {
    super(`credential '${guid}' is corrupted`);
    this.name = "CorruptedError";
    this.guid = guid;
  }
}

/**
 * Error thrown when a credential version is not supported.
 */
export class VersionError extends Error {
  readonly version: number;

  constructor(version: number) {
    super(`credential version not supported: ${version}`);
    this.name = "VersionError";
    this.version = version;
  }
}

/**
 * Error thrown when a credential's URL conflicts with an existing credential.
 */
export class IdentityCollisionError extends Error {
  readonly existingName: string;
  readonly existingUrl: string;
  readonly existingAccountName: string;

  constructor(name: string, url: string, accountName: string = "") {
    let message = `URL value conflicts with existing credential (${name}) URL: ${url}`;
    if (accountName) {
      message += `, account name: ${accountName}`;
    }
    super(message);
    this.name = "IdentityCollisionError";
    this.existingName = name;
    this.existingUrl = url;
    this.existingAccountName = accountName;
  }
}

/**
 * Error thrown when a credential's name conflicts with an existing credential.
 */
export class NameCollisionError extends Error {
  readonly existingName: string;
  readonly existingUrl: string;

  constructor(name: string, url: string) {
    super(
      `Name value conflicts with existing credential (${name}) URL: ${url}`,
    );
    this.name = "NameCollisionError";
    this.existingName = name;
    this.existingUrl = url;
  }
}

/**
 * Error thrown when creating a credential with incomplete fields.
 */
export class IncompleteCredentialError extends Error {
  constructor() {
    super(
      "New credentials require non-empty Name, URL, Server Type, and either API Key, Snowflake, or Connect Cloud connection fields",
    );
    this.name = "IncompleteCredentialError";
  }
}

/**
 * Error thrown when backing up credentials fails.
 */
export class BackupError extends Error {
  readonly filename: string;

  constructor(filename: string, cause: Error) {
    super(`Failed to backup credentials to ${filename}: ${cause.message}`);
    this.name = "BackupError";
    this.filename = filename;
  }
}

/**
 * Type guard for NotFoundError.
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard for LoadError.
 */
export function isLoadError(error: unknown): error is LoadError {
  return error instanceof LoadError;
}

/**
 * Type guard for CorruptedError.
 */
export function isCorruptedError(error: unknown): error is CorruptedError {
  return error instanceof CorruptedError;
}

/**
 * Type guard for VersionError.
 */
export function isVersionError(error: unknown): error is VersionError {
  return error instanceof VersionError;
}

/**
 * Type guard for IdentityCollisionError.
 */
export function isIdentityCollisionError(
  error: unknown,
): error is IdentityCollisionError {
  return error instanceof IdentityCollisionError;
}

/**
 * Type guard for NameCollisionError.
 */
export function isNameCollisionError(
  error: unknown,
): error is NameCollisionError {
  return error instanceof NameCollisionError;
}

/**
 * Type guard for IncompleteCredentialError.
 */
export function isIncompleteCredentialError(
  error: unknown,
): error is IncompleteCredentialError {
  return error instanceof IncompleteCredentialError;
}

/**
 * Type guard for BackupError.
 */
export function isBackupError(error: unknown): error is BackupError {
  return error instanceof BackupError;
}
