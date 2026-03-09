// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import { parse as parseTOML, TomlError } from "smol-toml";
import Ajv2020, { ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationLocation,
  ContentType,
} from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";
import { convertKeysToCamelCase } from "./convertKeys";
import {
  createInvalidTOMLError,
  createSchemaValidationError,
  createConfigurationError,
  ConfigurationLoadError,
} from "./errors";
import schema from "./schemas/posit-publishing-schema-v3.json";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

/**
 * Load a TOML configuration file, validate it against the JSON schema,
 * and return a Configuration.
 *
 * Throws ConfigurationLoadError for invalid TOML or schema/business validation failures.
 * Throws raw errors for I/O failures (ENOENT etc.).
 */
export async function loadConfigFromFile(
  configPath: string,
  projectDir: string,
): Promise<Configuration> {
  const configName = path.basename(configPath, ".toml");

  const location: ConfigurationLocation = {
    configurationName: configName,
    configurationPath: configPath,
    projectDir,
  };

  // Read file — let ENOENT propagate
  const content = await fs.readFile(configPath, "utf-8");

  // Parse TOML
  let parsed;
  try {
    parsed = parseTOML(content);
  } catch (err: unknown) {
    if (err instanceof TomlError) {
      const line = err.line ?? 0;
      const column = err.column ?? 0;
      throw new ConfigurationLoadError(
        createConfigurationError(
          createInvalidTOMLError(configPath, err.message, line, column),
          location,
        ),
      );
    }
    throw new ConfigurationLoadError(
      createConfigurationError(
        createInvalidTOMLError(configPath, String(err), 0, 0),
        location,
      ),
    );
  }

  // Validate against JSON schema (schema uses snake_case keys, which is what TOML produces)
  const valid = validate(parsed);
  if (!valid) {
    const messages = formatValidationErrors(validate.errors ?? []);
    throw new ConfigurationLoadError(
      createConfigurationError(
        createSchemaValidationError(configPath, messages),
        location,
      ),
    );
  }

  // Extract leading comments from the raw file content (matches Go's readLeadingComments).
  // TOML strips comments during parsing, so we read them from the raw text.
  const comments = readLeadingComments(content);

  // Convert keys to camelCase and apply defaults to match Go's New() + PopulateDefaults().
  // The assertion is justified: the JSON schema validation above confirmed the object
  // structure, and convertKeysToCamelCase only renames keys without changing the shape.
  const converted = convertKeysToCamelCase(parsed) as ConfigurationDetails;
  converted.comments = comments;

  if (converted.productType === undefined) {
    converted.productType = ProductType.CONNECT;
  }
  if (converted.validate === undefined) {
    converted.validate = true;
  }
  if (converted.files === undefined) {
    converted.files = [];
  }
  // Business validation beyond schema: reject Connect Cloud configs with
  // unsupported content types. Matches Go's validate() in config.go.
  // This might make more sense as a deployment-time concern later, but for
  // now we match Go's FromFile behavior which rejects at load time.
  if (converted.productType === ProductType.CONNECT_CLOUD) {
    if (!connectCloudSupportedTypes.has(converted.type)) {
      throw new ConfigurationLoadError(
        createConfigurationError(
          createSchemaValidationError(
            configPath,
            `content type '${converted.type}' is not supported by Connect Cloud`,
          ),
          location,
        ),
      );
    }
  }

  return {
    configuration: converted,
    ...location,
  };
}

// Extract leading comment lines from raw file content.
// Matches Go's readLeadingComments: collects consecutive lines starting
// with '#' from the top of the file, stripping the '#' prefix.
function readLeadingComments(content: string): string[] {
  const comments: string[] = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("#")) {
      break;
    }
    comments.push(line.slice(1));
  }
  return comments;
}

/**
 * Format ajv validation errors to match Go's schema validation output.
 * Go format: "key: problem" (e.g., "invalidParam: not allowed.")
 * For nested paths: "python.garbage: not allowed."
 */
function formatValidationErrors(errors: ErrorObject[]): string {
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

// Content types that have a mapping in Connect Cloud.
// Keep in sync with Go's CloudContentTypeFromPublisherType in internal/clients/types/types.go
const connectCloudSupportedTypes = new Set<ContentType>([
  ContentType.JUPYTER_NOTEBOOK,
  ContentType.PYTHON_BOKEH,
  ContentType.PYTHON_DASH,
  ContentType.PYTHON_SHINY,
  ContentType.R_SHINY,
  ContentType.PYTHON_STREAMLIT,
  ContentType.QUARTO,
  ContentType.QUARTO_SHINY,
  ContentType.QUARTO_STATIC,
  ContentType.RMD,
  ContentType.HTML,
]);
