// Copyright (C) 2026 by Posit Software, PBC.

import { AgentError } from "../api/types/error";
import {
  ConfigurationError,
  ConfigurationLocation,
} from "../api/types/configurations";

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
    msg: `Schema validation failed for ${file}: ${message}`,
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
