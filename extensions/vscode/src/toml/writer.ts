// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import { stringify as stringifyTOML } from "smol-toml";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationLocation,
  ContentType,
} from "../api/types/configurations";
import { forceProductTypeCompliance } from "./compliance";
import { convertKeysToSnakeCase } from "./convertKeys";
import {
  createSchemaValidationError,
  createConfigurationError,
  ConfigurationLoadError,
} from "./errors";
import schema from "./schemas/posit-publishing-schema-v3.json";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

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
 * Throws ConfigurationLoadError for validation failures.
 */
export async function writeConfigToFile(
  configPath: string,
  projectDir: string,
  config: ConfigurationDetails,
): Promise<Configuration> {
  const configName = path.basename(configPath, ".toml");

  const location: ConfigurationLocation = {
    configurationName: configName,
    configurationPath: configPath,
    projectDir,
  };

  // Clone so we don't mutate the caller's object
  const cfg = structuredClone(config);

  // Extract comments before compliance (compliance doesn't touch them)
  const comments = cfg.comments ?? [];

  // Apply product-type compliance transformations
  forceProductTypeCompliance(cfg);

  // Remove non-TOML fields
  delete cfg.comments;
  delete cfg.alternatives;

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
    const messages = (validate.errors ?? [])
      .map((e) => `${e.instancePath} ${e.message ?? ""}`.trim())
      .join("; ");
    throw new ConfigurationLoadError(
      createConfigurationError(
        createSchemaValidationError(configPath, messages),
        location,
      ),
    );
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

/**
 * Recursively strip empty values from an object to match Go's omitempty TOML
 * encoding behavior. Removes keys whose values are:
 * - undefined or null
 * - empty strings ("")
 * - empty objects ({})
 *
 * Mutates the object in place.
 */
function stripEmpty(obj: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      delete obj[key];
    } else if (typeof value === "string" && value === "") {
      delete obj[key];
    } else if (isRecord(value)) {
      if (Object.keys(value).length === 0) {
        delete obj[key];
      } else {
        stripEmpty(value);
        // Re-check if it became empty after stripping children
        if (Object.keys(value).length === 0) {
          delete obj[key];
        }
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
