// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import { stringify as stringifyTOML } from "smol-toml";
import {
  Configuration,
  ConfigurationDetails,
  ConfigurationLocation,
  ContentType,
} from "../api/types/configurations";
import { AgentError } from "../api/types/error";
import { forceProductTypeCompliance } from "./configCompliance";
import { convertKeysToSnakeCase } from "./convertKeys";
import { getConfigPath } from "./configDiscovery";
import { stripEmpty, isRecord, formatValidationErrors } from "./tomlHelpers";
import {
  createSchemaValidationError,
  createConfigurationError,
  ConfigurationLoadError,
} from "./configErrors";
import { validate } from "./configValidate";

/**
 * Write a configuration to a TOML file.
 *
 * 1. Clone config (don't mutate input)
 * 2. Apply product-type compliance transformations
 * 3. Convert keys to snake_case
 * 4. Strip empty/undefined values to match Go's omitempty behavior
 * 5. Validate against JSON schema
 * 6. Write comment lines + TOML content
 * 7. Return the written Configuration with location metadata
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 * @param config - The configuration details to write
 *
 * Throws ConfigurationLoadError for validation failures.
 */
export async function writeConfigToFile(
  configName: string,
  projectDir: string,
  rootDir: string,
  config: ConfigurationDetails,
): Promise<Configuration> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);

  const location: ConfigurationLocation = {
    configurationName: configName,
    configurationPath: configPath,
    projectDir,
  };

  const loadError = (error: AgentError) =>
    new ConfigurationLoadError(createConfigurationError(error, location));

  // Clone so we don't mutate the caller's object
  const cfg = structuredClone(config);

  // Extract comments before compliance (compliance doesn't touch them)
  const comments = cfg.comments ?? [];

  // Apply product-type compliance transformations
  forceProductTypeCompliance(cfg);

  // Remove non-TOML fields
  delete cfg.comments;
  delete cfg.alternatives;
  delete cfg.entrypointObjectRef;

  // Convert to snake_case for TOML
  const snakeResult = convertKeysToSnakeCase(cfg);
  if (!isRecord(snakeResult)) {
    throw new Error("unexpected: snake_case conversion did not return object");
  }
  const snakeObj = snakeResult;

  // Strip empty values to match Go's omitempty behavior.
  // Go's TOML encoder with omitempty skips empty strings, nil pointers,
  // and empty slices for fields tagged with omitempty.
  stripEmpty(snakeObj);

  // Handle type: "unknown" — the schema doesn't allow it, but we permit
  // creating configs with unknown type. Substitute "html" for validation,
  // then restore.
  const originalType = snakeObj["type"];
  if (originalType === "unknown") {
    snakeObj["type"] = ContentType.HTML;
  }

  // Validate against JSON schema
  const valid = validate(snakeObj);
  if (!valid) {
    const messages = formatValidationErrors(validate.errors ?? []);
    throw loadError(createSchemaValidationError(configPath, messages));
  }

  // Restore original type after validation
  if (originalType === "unknown") {
    snakeObj["type"] = originalType;
  }

  // Build file content: comment lines + TOML
  let content = "";
  for (const comment of comments) {
    content += `#${comment}\n`;
  }
  content += stringifyTOML(snakeObj);
  // Ensure file ends with newline
  if (!content.endsWith("\n")) {
    content += "\n";
  }

  // Create directory if needed and write file
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, content, "utf-8");

  return {
    configuration: {
      ...cfg,
      comments,
      // Restore the original type in case we substituted for validation
      type: config.type,
    },
    ...location,
  };
}
