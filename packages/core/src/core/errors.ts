// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Domain errors for the Configuration domain.
 *
 * Adapters translate infrastructure-specific errors (file not found,
 * TOML parse failure, etc.) into these domain error types.
 */

/**
 * The requested configuration does not exist.
 */
export class ConfigurationNotFoundError extends Error {
  constructor(name: string, options?: ErrorOptions) {
    super(`Configuration not found: ${name}`, options);
    this.name = "ConfigurationNotFoundError";
  }
}

/**
 * A configuration file exists but could not be read or parsed.
 * This is distinct from "not found" — the file is present but broken.
 */
export class ConfigurationReadError extends Error {
  constructor(name: string, message: string, options?: ErrorOptions) {
    super(`Error reading configuration "${name}": ${message}`, options);
    this.name = "ConfigurationReadError";
  }
}

/**
 * A configuration does not pass domain validation (e.g. unsupported
 * content type for the target product).
 */
export class ConfigurationValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfigurationValidationError";
  }
}
