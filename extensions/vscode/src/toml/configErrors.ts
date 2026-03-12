// Copyright (C) 2026 by Posit Software, PBC.

import { AgentError } from "../api/types/error";
import {
  ConfigurationError,
  ConfigurationLocation,
} from "../api/types/configurations";

/**
 * Error thrown by the loader when a config file has invalid TOML or
 * fails schema/business validation. Carries the structured
 * ConfigurationError so discovery functions can collect it.
 */
export class ConfigurationLoadError extends Error {
  constructor(public readonly configurationError: ConfigurationError) {
    super(configurationError.error.msg);
    this.name = "ConfigurationLoadError";
  }
}

export function createInvalidTOMLError(
  file: string,
  problem: string,
  line: number,
  column: number,
): AgentError {
  return {
    code: "invalidTOML",
    msg: `Invalid TOML in ${file}: ${problem}`,
    operation: "config.loadFromFile",
    data: { file, problem, line, column },
  };
}

export function createSchemaValidationError(
  file: string,
  message: string,
): AgentError {
  return {
    code: "tomlValidationError",
    msg: message,
    operation: "config.loadFromFile",
    data: { file, message },
  };
}

export function createConfigurationError(
  error: AgentError,
  location: ConfigurationLocation,
): ConfigurationError {
  return {
    error,
    ...location,
  };
}
