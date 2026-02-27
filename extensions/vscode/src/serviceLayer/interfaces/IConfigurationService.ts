// Copyright (C) 2025 by Posit Software, PBC.

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "src/api/types/configurations";

/**
 * Transport-agnostic error codes for configuration service operations.
 * These replace HTTP status codes as the error discrimination mechanism,
 * so call sites don't need to know whether the service is backed by
 * an HTTP API or direct filesystem access.
 */
export type ConfigServiceErrorCode =
  | "not-found"
  | "invalid-toml"
  | "unknown";

/**
 * Service-level error thrown by both Go backend adapter and TypeScript
 * implementation. Call sites should catch this instead of AxiosError.
 */
export class ConfigServiceError extends Error {
  readonly code: ConfigServiceErrorCode;
  readonly cause?: unknown;

  constructor(
    code: ConfigServiceErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ConfigServiceError";
    this.code = code;
    this.cause = cause;
  }
}

export function isConfigServiceError(err: unknown): err is ConfigServiceError {
  return err instanceof ConfigServiceError;
}

/**
 * Service contract for configuration CRUD operations.
 * Both the Go backend adapter and TypeScript implementation must satisfy this interface.
 *
 * Methods that can fail due to missing configs should throw ConfigServiceError
 * with code "not-found" rather than letting transport-specific errors propagate.
 */
export interface IConfigurationService {
  getAll(
    dir: string,
    params?: { entrypoint?: string; recursive?: boolean },
  ): Promise<Array<Configuration | ConfigurationError>>;

  get(
    configName: string,
    dir: string,
  ): Promise<Configuration | ConfigurationError>;

  createOrUpdate(
    configName: string,
    cfg: ConfigurationDetails,
    dir: string,
  ): Promise<Configuration>;

  delete(configName: string, dir: string): Promise<void>;

  getSecrets(configName: string, dir: string): Promise<string[]>;

  addSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration>;

  removeSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration>;
}
