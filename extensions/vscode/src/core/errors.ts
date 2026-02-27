// Copyright (C) 2025 by Posit Software, PBC.

import { AgentError, AgentErrorInvalidTOML } from "src/api/types/error";
import {
  ConfigurationError,
  ConfigurationLocation,
} from "src/api/types/configurations";

export function createInvalidTOMLError(
  file: string,
  problem: string,
  line: number,
  column: number,
): AgentErrorInvalidTOML {
  return {
    code: "invalidTOML",
    msg: problem,
    operation: "parse",
    data: {
      problem,
      file,
      line,
      column,
    },
  };
}

export function createSchemaValidationError(
  file: string,
  message: string,
): AgentError {
  return {
    code: "tomlValidationError",
    msg: message,
    operation: "validate",
    data: {
      problem: message,
      file,
    },
  };
}

export function createConfigurationError(
  error: AgentError,
  location: ConfigurationLocation,
): ConfigurationError {
  return {
    ...location,
    error,
  };
}
