// Copyright (C) 2026 by Posit Software, PBC.

import { AgentError } from "../api/types/error";
import {
  ContentRecordError,
  ContentRecordLocation,
  ContentRecordState,
} from "../api/types/contentRecords";

/**
 * Error thrown by the deployment loader when a deployment record file has
 * invalid TOML or fails schema validation. Carries the structured
 * ContentRecordError so discovery functions can collect it.
 */
export class ContentRecordLoadError extends Error {
  constructor(public readonly contentRecordError: ContentRecordError) {
    super(contentRecordError.error.msg);
    this.name = "ContentRecordLoadError";
  }
}

export function createInvalidDeploymentTOMLError(
  file: string,
  problem: string,
  line: number,
  column: number,
): AgentError {
  return {
    code: "invalidTOML",
    msg: `Invalid TOML in ${file}: ${problem}`,
    operation: "deployment.loadFromFile",
    data: { file, problem, line, column },
  };
}

export function createDeploymentSchemaValidationError(
  file: string,
  message: string,
): AgentError {
  return {
    code: "tomlValidationError",
    msg: message,
    operation: "deployment.loadFromFile",
    data: { file, message },
  };
}

export function createContentRecordError(
  error: AgentError,
  location: ContentRecordLocation,
): ContentRecordError {
  return {
    error,
    state: ContentRecordState.ERROR,
    ...location,
  };
}
