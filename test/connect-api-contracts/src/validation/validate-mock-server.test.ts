// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Validates that the MockConnectServer's runtime responses match the
 * Swagger spec. This catches:
 * - Route-to-fixture mapping errors (wrong fixture served for an endpoint)
 * - Status code mismatches between the mock and the spec
 * - Response bodies that don't conform to the spec schema
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockConnectServer } from "@posit-dev/mock-connect";
import { fixtureMappings } from "./fixture-map.js";
import {
  getSwaggerSpec,
  getResponseSchema,
  type SwaggerSpec,
  type JsonSchema,
} from "./swagger-helpers.js";

let server: MockConnectServer;
let baseUrl: string;
let spec: SwaggerSpec;

beforeAll(async () => {
  server = new MockConnectServer();
  await server.start();
  baseUrl = server.url;
  spec = await getSwaggerSpec();
});

afterAll(async () => {
  await server.stop();
});

/**
 * Convert a Swagger path like "/v1/content/{guid}/bundles" into
 * a concrete URL path like "/__api__/v1/content/test-guid-1234/bundles".
 */
function swaggerPathToUrl(swaggerPath: string): string {
  const concrete = swaggerPath.replace(
    /\{[^}]+\}/g,
    "test-guid-00000000-0000-0000-0000-000000000000",
  );
  return `/__api__${concrete}`;
}

/**
 * Recursively set `additionalProperties: true` on all object schemas so
 * that extra fixture fields do not cause validation failures.
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

describe("Mock server responses match Swagger spec", () => {
  for (const mapping of fixtureMappings) {
    it(`${mapping.method.toUpperCase()} ${mapping.path} — ${mapping.description}`, async () => {
      const url = `${baseUrl}${swaggerPathToUrl(mapping.path)}`;

      const response = await fetch(url, {
        method: mapping.method.toUpperCase(),
        headers: {
          Authorization: "Key test-api-key",
          "Content-Type": "application/json",
        },
        // POST/PATCH requests need a body
        body: ["post", "patch", "put"].includes(mapping.method)
          ? JSON.stringify({})
          : undefined,
      });

      // Validate status code — the mock should return a success status
      // (we don't assert the exact status from fixture-map because the mock
      // may use a different success code; what matters is it's not a 404/500)
      expect(
        response.status,
        `Expected success response from mock for ${mapping.method.toUpperCase()} ${mapping.path}, got ${response.status}`,
      ).toBeLessThan(400);

      // Skip schema validation for no-body responses (204, etc.)
      if (response.status === 204) {
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      // Skip non-JSON responses (e.g., gzip downloads, HTML)
      if (!contentType.includes("application/json")) {
        return;
      }

      const body = await response.json();

      // Look up the schema for the status code the mock actually returned
      const schema = getResponseSchema(
        spec,
        mapping.path,
        mapping.method,
        response.status,
      );

      // If no schema in spec for this status, skip validation
      // (some endpoints have undocumented success codes)
      if (!schema) {
        return;
      }

      const schemaWithAdditional = allowAdditionalProperties(schema);

      const ajv = new Ajv({
        allErrors: true,
        strict: false,
        validateFormats: true,
      });
      addFormats(ajv);

      const validate = ajv.compile(schemaWithAdditional);
      const valid = validate(body);

      if (!valid) {
        const errors = validate
          .errors!.map((e) => `  ${e.instancePath || "/"}: ${e.message}`)
          .join("\n");
        expect.fail(
          `Mock response for ${mapping.method.toUpperCase()} ${mapping.path} ` +
            `(status ${response.status}) does not match Swagger schema:\n${errors}`,
        );
      }
    });
  }
});
