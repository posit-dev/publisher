// Copyright (C) 2025 by Posit Software, PBC.

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse as parseTOML } from "smol-toml";
import Ajv from "ajv/dist/2020";
import addFormats from "ajv-formats";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "src/api/types/configurations";
import { ConfigurationStore } from "src/core/ports";
import {
  createInvalidTOMLError,
  createSchemaValidationError,
  createConfigurationError,
} from "src/core/errors";
import { convertKeysToCamelCase } from "src/core/conversion";
import schema from "src/core/schemas/posit-publishing-schema-v3.json";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

export class FSConfigurationStore implements ConfigurationStore {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async get(
    configName: string,
    projectDir: string,
  ): Promise<Configuration | ConfigurationError> {
    const absoluteProjectDir = path.resolve(this.workspaceRoot, projectDir);
    const configPath = path.join(
      absoluteProjectDir,
      ".posit",
      "publish",
      `${configName}.toml`,
    );
    const relPath = path.join(".posit", "publish", `${configName}.toml`);

    const location = {
      configurationName: configName,
      configurationPath: configPath,
      configurationRelPath: relPath,
      projectDir,
    };

    // Read file — ENOENT (file-not-found) throws to caller
    const content = await fs.readFile(configPath, "utf-8");

    // Parse TOML
    let rawData: Record<string, unknown>;
    try {
      rawData = parseTOML(content) as Record<string, unknown>;
    } catch (err: unknown) {
      const problem =
        err instanceof Error ? err.message : "Failed to parse TOML";
      // smol-toml errors have `line` and `column` properties
      const line = hasNumericProp(err, "line") ? err.line : 1;
      const column = hasNumericProp(err, "column") ? err.column : 1;
      return createConfigurationError(
        createInvalidTOMLError(configPath, problem, line, column),
        location,
      );
    }

    // Validate against JSON schema (snake_case data)
    const valid = validate(rawData);
    if (!valid && validate.errors?.length) {
      const firstError = validate.errors[0]!;
      const message = firstError.instancePath
        ? `${firstError.instancePath}: ${firstError.message}`
        : (firstError.message ?? "Schema validation failed");
      return createConfigurationError(
        createSchemaValidationError(configPath, message),
        location,
      );
    }

    // Convert snake_case keys to camelCase
    const camelCaseData = convertKeysToCamelCase(
      rawData,
    ) as ConfigurationDetails;

    return {
      ...location,
      configuration: camelCaseData,
    };
  }
}

function hasNumericProp<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, number> {
  return (
    obj !== null &&
    typeof obj === "object" &&
    key in obj &&
    typeof (obj as Record<string, unknown>)[key] === "number"
  );
}
