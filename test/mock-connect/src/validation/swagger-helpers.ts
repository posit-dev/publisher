// Copyright (C) 2026 by Posit Software, PBC.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", "..", ".cache");
const CACHE_FILE = join(CACHE_DIR, "swagger.json");
const SWAGGER_URL = "https://docs.posit.co/connect/api/swagger.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------- Types for the subset of Swagger 2.0 we care about ----------

export interface SwaggerSpec {
  swagger: string;
  paths: Record<string, SwaggerPathItem>;
  definitions: Record<string, JsonSchema>;
}

export interface SwaggerPathItem {
  [method: string]: SwaggerOperation;
}

export interface SwaggerOperation {
  responses: Record<string, SwaggerResponse>;
}

export interface SwaggerResponse {
  description?: string;
  schema?: JsonSchema;
}

export interface JsonSchema {
  type?: string | string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  $ref?: string;
  "x-nullable"?: boolean;
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  enum?: unknown[];
  format?: string;
  [key: string]: unknown;
}

// ---------- Spec fetching + caching ----------

function isCacheValid(): boolean {
  if (!existsSync(CACHE_FILE)) return false;
  const mtime = statSync(CACHE_FILE).mtimeMs;
  return Date.now() - mtime < CACHE_TTL_MS;
}

export async function getSwaggerSpec(): Promise<SwaggerSpec> {
  if (isCacheValid()) {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as SwaggerSpec;
  }

  const res = await fetch(SWAGGER_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Swagger spec: ${res.status} ${res.statusText}`,
    );
  }

  const text = await res.text();

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, text, "utf-8");

  return JSON.parse(text) as SwaggerSpec;
}

// ---------- $ref resolution ----------

/**
 * Recursively resolve all `$ref` pointers in a schema against the spec's
 * `definitions` section. Returns a new schema object with all references
 * inlined (with cycle protection).
 */
export function dereferenceSchema(
  schema: JsonSchema,
  definitions: Record<string, JsonSchema>,
  seen: Set<string> = new Set(),
): JsonSchema {
  if (schema.$ref) {
    const refPath = schema.$ref; // e.g. "#/definitions/User"
    const defName = refPath.replace("#/definitions/", "");

    if (seen.has(defName)) {
      // Cycle detected — return a permissive schema to avoid infinite recursion
      return {};
    }

    const def = definitions[defName];
    if (!def) {
      throw new Error(`Missing definition: ${refPath}`);
    }

    seen.add(defName);
    return dereferenceSchema(def, definitions, seen);
  }

  const resolved: JsonSchema = { ...schema };

  if (resolved.properties) {
    const props: Record<string, JsonSchema> = {};
    for (const [key, prop] of Object.entries(resolved.properties)) {
      props[key] = dereferenceSchema(prop, definitions, new Set(seen));
    }
    resolved.properties = props;
  }

  if (resolved.items) {
    resolved.items = dereferenceSchema(
      resolved.items,
      definitions,
      new Set(seen),
    );
  }

  if (resolved.allOf) {
    resolved.allOf = resolved.allOf.map((s) =>
      dereferenceSchema(s, definitions, new Set(seen)),
    );
  }

  if (
    resolved.additionalProperties &&
    typeof resolved.additionalProperties === "object"
  ) {
    resolved.additionalProperties = dereferenceSchema(
      resolved.additionalProperties as JsonSchema,
      definitions,
      new Set(seen),
    );
  }

  return resolved;
}

// ---------- x-nullable → JSON Schema nullable ----------

/**
 * Recursively transforms Swagger 2.0 `x-nullable: true` into
 * JSON Schema Draft 4 compatible `type: ["<original>", "null"]`.
 */
export function transformNullable(schema: JsonSchema): JsonSchema {
  const result: JsonSchema = { ...schema };

  if (result["x-nullable"] === true && typeof result.type === "string") {
    result.type = [result.type, "null"];
    delete result["x-nullable"];
  }

  if (result.properties) {
    const props: Record<string, JsonSchema> = {};
    for (const [key, prop] of Object.entries(result.properties)) {
      props[key] = transformNullable(prop);
    }
    result.properties = props;
  }

  if (result.items) {
    result.items = transformNullable(result.items);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(transformNullable);
  }

  if (
    result.additionalProperties &&
    typeof result.additionalProperties === "object"
  ) {
    result.additionalProperties = transformNullable(
      result.additionalProperties as JsonSchema,
    );
  }

  return result;
}

// ---------- High-level schema extraction ----------

/**
 * Extract the fully resolved and nullable-transformed response schema for
 * a given endpoint from the Swagger spec.
 */
export function getResponseSchema(
  spec: SwaggerSpec,
  path: string,
  method: string,
  status: number,
): JsonSchema | null {
  const pathItem = spec.paths[path];
  if (!pathItem) return null;

  const operation = pathItem[method];
  if (!operation) return null;

  const response = operation.responses[String(status)];
  if (!response?.schema) return null;

  const dereffed = dereferenceSchema(response.schema, spec.definitions);
  return transformNullable(dereffed);
}

/**
 * Collect the set of property names that exist in the fixture but are NOT
 * present in the schema. These are "extra" fields — not necessarily wrong,
 * but worth a warning.
 */
export function findExtraFields(
  fixture: Record<string, unknown>,
  schema: JsonSchema,
): string[] {
  if (!schema.properties) return [];

  const specKeys = new Set(Object.keys(schema.properties));
  return Object.keys(fixture).filter((k) => !specKeys.has(k));
}
