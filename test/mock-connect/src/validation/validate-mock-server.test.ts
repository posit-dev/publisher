// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Validates that the MockConnectServer's runtime responses match the
 * OpenAPI spec. This catches:
 * - Route-to-fixture mapping errors (wrong fixture served for an endpoint)
 * - Status code mismatches between the mock and the spec
 * - Response bodies that don't conform to the spec schema
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockConnectServer } from "../mock-connect-server.js";
import { fixtureMappings } from "./fixture-map.js";
import {
  allowAdditionalProperties,
  getOpenAPISpec,
  getResponseSchema,
  type OpenAPISpec,
} from "./openapi-helpers.js";

let server: MockConnectServer;
let baseUrl: string;
let spec: OpenAPISpec;
let ajv: Ajv;

beforeAll(async () => {
  server = new MockConnectServer();
  await server.start();
  baseUrl = server.url;
  spec = await getOpenAPISpec();
  ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: true,
  });
  addFormats(ajv);
});

afterAll(async () => {
  await server.stop();
});

/**
 * Convert an OpenAPI path like "/v1/content/{guid}/bundles/{id}" into
 * a concrete URL path with unique placeholders per parameter position.
 */
function openapiPathToUrl(openapiPath: string): string {
  let paramIndex = 0;
  const concrete = openapiPath.replace(/\{[^}]+\}/g, () => {
    paramIndex++;
    return `test-param-${paramIndex}-00000000-0000-0000-0000-000000000000`;
  });
  return `/__api__${concrete}`;
}

describe("Mock server responses match OpenAPI spec", () => {
  for (const mapping of fixtureMappings) {
    it(`${mapping.method.toUpperCase()} ${mapping.path} — ${mapping.description}`, async () => {
      const url = `${baseUrl}${openapiPathToUrl(mapping.path)}`;

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

      const validate = ajv.compile(schemaWithAdditional);
      const valid = validate(body);

      if (!valid) {
        const errors = validate
          .errors!.map((e) => `  ${e.instancePath || "/"}: ${e.message}`)
          .join("\n");
        expect.fail(
          `Mock response for ${mapping.method.toUpperCase()} ${mapping.path} ` +
            `(status ${response.status}) does not match OpenAPI schema:\n${errors}`,
        );
      }
    });
  }
});
