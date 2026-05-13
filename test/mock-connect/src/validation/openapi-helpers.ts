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
const CACHE_FILE = join(CACHE_DIR, "openapi.json");
const OPENAPI_URL = "https://docs.posit.co/connect/api/openapi.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------- Types for the subset of OpenAPI 3.0 we care about ----------

export interface OpenAPISpec {
  openapi: string;
  paths: Record<string, OpenAPIPathItem>;
  components: {
    schemas: Record<string, JsonSchema>;
  };
}

export interface OpenAPIPathItem {
  [method: string]: OpenAPIOperation;
}

export interface OpenAPIOperation {
  responses: Record<string, OpenAPIResponse>;
}

export interface OpenAPIResponse {
  description?: string;
  content?: {
    "application/json"?: {
      schema?: JsonSchema;
    };
  };
}

export interface JsonSchema {
  type?: string | string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  $ref?: string;
  nullable?: boolean;
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

export async function getOpenAPISpec(): Promise<OpenAPISpec> {
  if (isCacheValid()) {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as OpenAPISpec;
  }

  const res = await fetch(OPENAPI_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`,
    );
  }

  const text = await res.text();

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, text, "utf-8");

  return JSON.parse(text) as OpenAPISpec;
}

// ---------- $ref resolution ----------

/**
 * Recursively resolve all `$ref` pointers in a schema against the spec's
 * `components.schemas` section. Returns a new schema object with all
 * references inlined (with cycle protection).
 */
export function dereferenceSchema(
  schema: JsonSchema,
  schemas: Record<string, JsonSchema>,
  seen: Set<string> = new Set(),
): JsonSchema {
  if (schema.$ref) {
    const refPath = schema.$ref; // e.g. "#/components/schemas/User"
    const defName = refPath.replace("#/components/schemas/", "");

    if (seen.has(defName)) {
      // Cycle detected — return a permissive schema to avoid infinite recursion
      return {};
    }

    const def = schemas[defName];
    if (!def) {
      throw new Error(`Missing schema: ${refPath}`);
    }

    seen.add(defName);
    return dereferenceSchema(def, schemas, seen);
  }

  const resolved: JsonSchema = { ...schema };

  if (resolved.properties) {
    const props: Record<string, JsonSchema> = {};
    for (const [key, prop] of Object.entries(resolved.properties)) {
      props[key] = dereferenceSchema(prop, schemas, new Set(seen));
    }
    resolved.properties = props;
  }

  if (resolved.items) {
    resolved.items = dereferenceSchema(resolved.items, schemas, new Set(seen));
  }

  if (resolved.allOf) {
    resolved.allOf = resolved.allOf.map((s) =>
      dereferenceSchema(s, schemas, new Set(seen)),
    );
  }

  if (resolved.oneOf) {
    resolved.oneOf = resolved.oneOf.map((s) =>
      dereferenceSchema(s, schemas, new Set(seen)),
    );
  }

  if (resolved.anyOf) {
    resolved.anyOf = resolved.anyOf.map((s) =>
      dereferenceSchema(s, schemas, new Set(seen)),
    );
  }

  if (
    resolved.additionalProperties &&
    typeof resolved.additionalProperties === "object"
  ) {
    resolved.additionalProperties = dereferenceSchema(
      resolved.additionalProperties as JsonSchema,
      schemas,
      new Set(seen),
    );
  }

  return resolved;
}

// ---------- nullable → JSON Schema nullable ----------

/**
 * Recursively transforms OpenAPI 3.0 `nullable: true` into JSON Schema
 * Draft 4 compatible `type: ["<original>", "null"]`. Ajv does not understand
 * OpenAPI's `nullable` keyword on its own.
 */
export function transformNullable(schema: JsonSchema): JsonSchema {
  const result: JsonSchema = { ...schema };

  if (result.nullable === true && typeof result.type === "string") {
    result.type = [result.type, "null"];
  }
  delete result.nullable;

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

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(transformNullable);
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(transformNullable);
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
 * a given endpoint from the OpenAPI spec.
 */
export function getResponseSchema(
  spec: OpenAPISpec,
  path: string,
  method: string,
  status: number,
): JsonSchema | null {
  const pathItem = spec.paths[path];
  if (!pathItem) return null;

  const operation = pathItem[method];
  if (!operation) return null;

  const response = operation.responses[String(status)];
  const schema = response?.content?.["application/json"]?.schema;
  if (!schema) return null;

  const dereffed = dereferenceSchema(schema, spec.components.schemas);
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
