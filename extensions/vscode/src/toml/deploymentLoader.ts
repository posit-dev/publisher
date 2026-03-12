// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import { parse as parseTOML, TomlError } from "smol-toml";

import {
  ContentRecord,
  ContentRecordLocation,
  ContentRecordState,
  PreContentRecord,
} from "../api/types/contentRecords";
import { AgentError } from "../api/types/error";
import { formatValidationErrors } from "./configErrors";
import { convertKeysToCamelCase } from "./convertKeys";
import {
  ContentRecordLoadError,
  createContentRecordError,
  createDeploymentSchemaValidationError,
  createInvalidDeploymentTOMLError,
} from "./deploymentErrors";
import { validateDeploymentRecord } from "./deploymentValidate";
import { getLogsUrl } from "./urlHelpers";

/**
 * Load a deployment record TOML file, validate it against the JSON schema,
 * and return a typed content record (PreContentRecord or ContentRecord).
 *
 * Throws ContentRecordLoadError for invalid TOML or schema validation failures.
 * Throws raw errors for I/O failures (ENOENT etc.).
 */
export async function loadDeploymentFromFile(
  deploymentPath: string,
  projectDir: string,
): Promise<PreContentRecord | ContentRecord> {
  const deploymentName = path.basename(deploymentPath, ".toml");

  const location: ContentRecordLocation = {
    deploymentName,
    deploymentPath,
    projectDir,
  };

  const loadError = (error: AgentError) =>
    new ContentRecordLoadError(createContentRecordError(error, location));

  // Read file — let ENOENT propagate
  const content = await fs.readFile(deploymentPath, "utf-8");

  // Parse TOML
  let parsed;
  try {
    parsed = parseTOML(content);
  } catch (err: unknown) {
    if (err instanceof TomlError) {
      const line = err.line ?? 0;
      const column = err.column ?? 0;
      throw loadError(
        createInvalidDeploymentTOMLError(
          deploymentPath,
          err.message,
          line,
          column,
        ),
      );
    }
    throw loadError(
      createInvalidDeploymentTOMLError(deploymentPath, String(err), 0, 0),
    );
  }

  // Validate against JSON schema (schema uses snake_case keys)
  const valid = validateDeploymentRecord(parsed);
  if (!valid) {
    const messages = formatValidationErrors(
      validateDeploymentRecord.errors ?? [],
    );
    throw loadError(
      createDeploymentSchemaValidationError(deploymentPath, messages),
    );
  }

  // Convert keys to camelCase
  const converted = convertKeysToCamelCase(parsed) as Record<string, unknown>;

  // Apply defaults matching Go's PopulateDefaults()
  if (
    !converted.logsUrl &&
    typeof converted.id === "string" &&
    converted.id !== "" &&
    typeof converted.serverUrl === "string"
  ) {
    converted.logsUrl = getLogsUrl(converted.serverUrl, converted.id);
  }

  // Determine state and return the appropriate type
  if (typeof converted.deployedAt === "string" && converted.deployedAt !== "") {
    return {
      ...converted,
      ...location,
      saveName: deploymentName,
      state: ContentRecordState.DEPLOYED,
    } as ContentRecord;
  }

  return {
    ...converted,
    ...location,
    saveName: deploymentName,
    state: ContentRecordState.NEW,
  } as PreContentRecord;
}
