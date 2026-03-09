// Copyright (C) 2026 by Posit Software, PBC.

import { ErrorObject } from "ajv/dist/2020";

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

/**
 * Format ajv validation errors to match Go's schema validation output.
 * Go format: "key: problem" (e.g., "invalidParam: not allowed.")
 * For nested paths: "python.garbage: not allowed."
 */
export function formatValidationErrors(errors: ErrorObject[]): string {
  const formatted: string[] = [];
  for (const e of errors) {
    // Convert JSON pointer instancePath (e.g., "/python") to dotted key
    const pathKey = e.instancePath.replace(/^\//, "").replace(/\//g, ".");

    if (
      e.keyword === "unevaluatedProperties" ||
      e.keyword === "additionalProperties"
    ) {
      const prop =
        e.params.unevaluatedProperty ?? e.params.additionalProperty ?? "";
      const fullKey = pathKey ? `${pathKey}.${prop}` : prop;
      formatted.push(`${fullKey}: not allowed.`);
    } else if (e.keyword === "required") {
      const prop = e.params.missingProperty ?? "";
      const fullKey = pathKey ? `${pathKey}.${prop}` : prop;
      formatted.push(`${fullKey}: missing property.`);
    } else if (e.keyword === "if") {
      // "if/then" errors are structural noise from conditional schemas — skip
      continue;
    } else {
      const prefix = pathKey ? `${pathKey}: ` : "";
      formatted.push(`${prefix}${e.message ?? "validation error"}.`);
    }
  }
  return formatted.join("; ");
}
