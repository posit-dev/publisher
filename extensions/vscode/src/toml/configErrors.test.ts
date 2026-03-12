// Copyright (C) 2026 by Posit Software, PBC.

import { ErrorObject } from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import {
  createInvalidTOMLError,
  createSchemaValidationError,
  createConfigurationError,
  formatValidationErrors,
} from "./configErrors";

describe("error factories", () => {
  it("creates an invalidTOML error", () => {
    const err = createInvalidTOMLError(
      "/path/to/file.toml",
      "unexpected '='",
      5,
      10,
    );
    expect(err.code).toBe("invalidTOML");
    expect(err.msg).toContain("/path/to/file.toml");
    expect(err.msg).toContain("unexpected '='");
    expect(err.operation).toBe("config.loadFromFile");
  });

  it("creates a schema validation error", () => {
    const err = createSchemaValidationError(
      "/path/to/file.toml",
      "missing required field",
    );
    expect(err.code).toBe("tomlValidationError");
    expect(err.msg).toContain("missing required field");
    expect(err.operation).toBe("config.loadFromFile");
  });

  it("creates a ConfigurationError with location", () => {
    const agentErr = createInvalidTOMLError("/p/file.toml", "bad", 1, 1);
    const location = {
      configurationName: "file",
      configurationPath: "/p/file.toml",
      projectDir: "/p",
    };
    const cfgErr = createConfigurationError(agentErr, location);
    expect(cfgErr.error).toBe(agentErr);
    expect(cfgErr.configurationName).toBe("file");
    expect(cfgErr.configurationPath).toBe("/p/file.toml");
    expect(cfgErr.projectDir).toBe("/p");
  });
});

// Helper to create minimal ErrorObject stubs for testing
function makeError(
  overrides: Partial<ErrorObject> & Pick<ErrorObject, "keyword">,
): ErrorObject {
  return {
    instancePath: "",
    schemaPath: "",
    params: {},
    ...overrides,
  } as ErrorObject;
}

describe("formatValidationErrors", () => {
  it("formats unevaluatedProperties as 'key: not allowed.'", () => {
    const result = formatValidationErrors([
      makeError({
        keyword: "unevaluatedProperties",
        instancePath: "",
        params: { unevaluatedProperty: "garbage" },
      }),
    ]);
    expect(result).toBe("garbage: not allowed.");
  });

  it("formats nested unevaluatedProperties", () => {
    const result = formatValidationErrors([
      makeError({
        keyword: "unevaluatedProperties",
        instancePath: "/python",
        params: { unevaluatedProperty: "foo" },
      }),
    ]);
    expect(result).toBe("python.foo: not allowed.");
  });

  it("formats required errors as 'key: missing property.'", () => {
    const result = formatValidationErrors([
      makeError({
        keyword: "required",
        instancePath: "/python",
        params: { missingProperty: "version" },
      }),
    ]);
    expect(result).toBe("python.version: missing property.");
  });

  it("skips 'if' keyword errors", () => {
    const result = formatValidationErrors([
      makeError({ keyword: "if", instancePath: "" }),
    ]);
    expect(result).toBe("");
  });

  it("formats generic errors with message", () => {
    const result = formatValidationErrors([
      makeError({
        keyword: "enum",
        instancePath: "/type",
        message: "must be equal to one of the allowed values",
      }),
    ]);
    expect(result).toBe("type: must be equal to one of the allowed values.");
  });

  it("joins multiple errors with '; '", () => {
    const result = formatValidationErrors([
      makeError({
        keyword: "additionalProperties",
        instancePath: "",
        params: { additionalProperty: "a" },
      }),
      makeError({
        keyword: "additionalProperties",
        instancePath: "",
        params: { additionalProperty: "b" },
      }),
    ]);
    expect(result).toBe("a: not allowed.; b: not allowed.");
  });

  it("keeps unevaluatedProperties alongside sibling errors at the same path", () => {
    // Go's key for unevaluatedProperties includes the property name
    // (e.g., "python.garbage"), so a sibling error at "python.version"
    // does NOT cause filtering — only a deeper error at
    // "python.garbage.something" would.
    const result = formatValidationErrors([
      makeError({
        keyword: "unevaluatedProperties",
        instancePath: "/python",
        params: { unevaluatedProperty: "garbage" },
      }),
      makeError({
        keyword: "required",
        instancePath: "/python",
        params: { missingProperty: "version" },
      }),
    ]);
    expect(result).toBe(
      "python.garbage: not allowed.; python.version: missing property.",
    );
  });

  it("filters unevaluatedProperties when a deeper error exists for the same key", () => {
    // If there's an error at "python.garbage.x", the unevaluatedProperties
    // error for "python.garbage" is redundant.
    const result = formatValidationErrors([
      makeError({
        keyword: "unevaluatedProperties",
        instancePath: "/python",
        params: { unevaluatedProperty: "garbage" },
      }),
      makeError({
        keyword: "required",
        instancePath: "/python/garbage",
        params: { missingProperty: "x" },
      }),
    ]);
    expect(result).toBe("python.garbage.x: missing property.");
  });

  it("keeps unevaluatedProperties when no other error shares the path", () => {
    const result = formatValidationErrors([
      makeError({
        keyword: "unevaluatedProperties",
        instancePath: "/python",
        params: { unevaluatedProperty: "garbage" },
      }),
      makeError({
        keyword: "required",
        instancePath: "/r",
        params: { missingProperty: "version" },
      }),
    ]);
    expect(result).toBe(
      "python.garbage: not allowed.; r.version: missing property.",
    );
  });

  it("does not filter additionalProperties even when a deeper error exists", () => {
    const result = formatValidationErrors([
      makeError({
        keyword: "additionalProperties",
        instancePath: "/python",
        params: { additionalProperty: "garbage" },
      }),
      makeError({
        keyword: "required",
        instancePath: "/python/garbage",
        params: { missingProperty: "x" },
      }),
    ]);
    expect(result).toBe(
      "python.garbage: not allowed.; python.garbage.x: missing property.",
    );
  });
});
