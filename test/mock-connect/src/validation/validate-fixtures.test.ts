// Copyright (C) 2026 by Posit Software, PBC.

import { readFileSync } from "fs";
import { join } from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, it, expect, beforeAll } from "vitest";
import { FIXTURES_DIR } from "../mock-connect-server.js";
import { fixtureMappings, skippedFixtures } from "./fixture-map.js";
import {
  allowAdditionalProperties,
  getOpenAPISpec,
  getResponseSchema,
  findExtraFields,
  type OpenAPISpec,
} from "./openapi-helpers.js";

let spec: OpenAPISpec;

beforeAll(async () => {
  spec = await getOpenAPISpec();
});

describe("Fixture validation against OpenAPI spec", () => {
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
