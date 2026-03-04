// Copyright (C) 2025 by Posit Software, PBC.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, it, expect, beforeAll } from "vitest";
import { fixtureMappings, skippedFixtures } from "./fixture-map.js";
import {
  getSwaggerSpec,
  getResponseSchema,
  findExtraFields,
  type SwaggerSpec,
  type JsonSchema,
} from "./swagger-helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "connect-responses");

let spec: SwaggerSpec;

beforeAll(async () => {
  spec = await getSwaggerSpec();
});

describe("Fixture validation against Swagger spec", () => {
  for (const mapping of fixtureMappings) {
    it(`${mapping.description} (${mapping.fixture})`, () => {
      const fixtureRaw = readFileSync(
        join(FIXTURES_DIR, mapping.fixture),
        "utf-8",
      );
      const fixture = JSON.parse(fixtureRaw);

      const schema = getResponseSchema(
        spec,
        mapping.path,
        mapping.method,
        mapping.status,
      );
      expect(
        schema,
        `No schema found for ${mapping.method.toUpperCase()} ${mapping.path} → ${mapping.status}`,
      ).not.toBeNull();

      const ajv = new Ajv({
        allErrors: true,
        strict: false,
        validateFormats: true,
      });
      addFormats(ajv);

      // Allow additional properties by default — we only want to validate
      // that the fields present in the spec have the correct types.
      const schemaWithAdditional = allowAdditionalProperties(schema!);

      const validate = ajv.compile(schemaWithAdditional);
      const valid = validate(fixture);

      if (!valid) {
        const errors = validate
          .errors!.map((e) => `  ${e.instancePath || "/"}: ${e.message}`)
          .join("\n");
        expect.fail(
          `Fixture ${mapping.fixture} does not match schema for ` +
            `${mapping.method.toUpperCase()} ${mapping.path} → ${mapping.status}:\n${errors}`,
        );
      }

      // Warn about extra fields not in the spec (non-failing)
      if (
        schema!.properties &&
        typeof fixture === "object" &&
        !Array.isArray(fixture)
      ) {
        const extras = findExtraFields(
          fixture as Record<string, unknown>,
          schema!,
        );
        if (extras.length > 0) {
          console.warn(
            `  ⚠ ${mapping.fixture}: fixture has fields not in spec: ${extras.join(", ")}`,
          );
        }
      }
    });
  }

  // Show skipped fixtures for visibility
  for (const skipped of skippedFixtures) {
    it.skip(`${skipped.fixture} — ${skipped.reason}`, () => {
      // intentionally empty
    });
  }
});

/**
 * Recursively set `additionalProperties: true` on all object schemas so
 * that extra fixture fields do not cause validation failures. We report
 * extra fields as warnings instead.
 */
function allowAdditionalProperties(schema: JsonSchema): JsonSchema {
  const result: JsonSchema = { ...schema };

  if (result.type === "object" || result.properties) {
    result.additionalProperties = true;
  }

  if (result.properties) {
    const props: Record<string, JsonSchema> = {};
    for (const [key, prop] of Object.entries(result.properties)) {
      props[key] = allowAdditionalProperties(prop);
    }
    result.properties = props;
  }

  if (result.items && typeof result.items === "object") {
    result.items = allowAdditionalProperties(result.items);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(allowAdditionalProperties);
  }

  return result;
}
