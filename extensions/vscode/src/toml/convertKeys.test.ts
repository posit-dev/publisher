// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { convertKeysToCamelCase, convertKeysToSnakeCase } from "./convertKeys";

describe("convertKeysToCamelCase", () => {
  it("converts basic snake_case keys", () => {
    const result = convertKeysToCamelCase({
      package_file: "requirements.txt",
      package_manager: "pip",
    });
    expect(result).toEqual({
      packageFile: "requirements.txt",
      packageManager: "pip",
    });
  });

  it("handles nested objects", () => {
    const result = convertKeysToCamelCase({
      connect: {
        runtime: {
          max_conns_per_process: 50,
          load_factor: 0.5,
        },
      },
    });
    expect(result).toEqual({
      connect: {
        runtime: {
          maxConnsPerProcess: 50,
          loadFactor: 0.5,
        },
      },
    });
  });

  it("handles arrays of objects", () => {
    const result = convertKeysToCamelCase({
      integration_requests: [{ auth_type: "oauth", guid: "abc-123" }],
    });
    expect(result).toEqual({
      integrationRequests: [{ authType: "oauth", guid: "abc-123" }],
    });
  });

  it("preserves environment keys (user-defined)", () => {
    const result = convertKeysToCamelCase({
      environment: {
        MY_API_KEY: "secret",
        DATABASE_URL: "postgres://...",
      },
    });
    expect(result).toEqual({
      environment: {
        MY_API_KEY: "secret",
        DATABASE_URL: "postgres://...",
      },
    });
  });

  it("preserves config keys inside integration_requests", () => {
    const result = convertKeysToCamelCase({
      integration_requests: [
        {
          guid: "abc",
          config: {
            some_custom_key: "value",
            ANOTHER_KEY: "val2",
          },
        },
      ],
    });
    expect(result).toEqual({
      integrationRequests: [
        {
          guid: "abc",
          config: {
            some_custom_key: "value",
            ANOTHER_KEY: "val2",
          },
        },
      ],
    });
  });

  it("passes through already-camelCase keys unchanged", () => {
    const result = convertKeysToCamelCase({
      authType: "oauth",
      loadFactor: 0.5,
      defaultImageName: "posit/connect",
    });
    expect(result).toEqual({
      authType: "oauth",
      loadFactor: 0.5,
      defaultImageName: "posit/connect",
    });
  });

  it("handles null and primitive values", () => {
    expect(convertKeysToCamelCase(null)).toBeNull();
    expect(convertKeysToCamelCase(42)).toBe(42);
    expect(convertKeysToCamelCase("hello")).toBe("hello");
    expect(convertKeysToCamelCase(true)).toBe(true);
  });

  it("handles arrays of primitives", () => {
    const result = convertKeysToCamelCase({
      files: ["app.py", "model.csv"],
    });
    expect(result).toEqual({
      files: ["app.py", "model.csv"],
    });
  });

  it("converts connect_cloud nested keys", () => {
    const result = convertKeysToCamelCase({
      connect_cloud: {
        vanity_name: "my-app",
        access_control: {
          public_access: true,
          organization_access: "viewer",
        },
      },
    });
    expect(result).toEqual({
      connectCloud: {
        vanityName: "my-app",
        accessControl: {
          publicAccess: true,
          organizationAccess: "viewer",
        },
      },
    });
  });
});

describe("convertKeysToSnakeCase", () => {
  it("converts basic camelCase keys", () => {
    const result = convertKeysToSnakeCase({
      packageFile: "requirements.txt",
      packageManager: "pip",
    });
    expect(result).toEqual({
      package_file: "requirements.txt",
      package_manager: "pip",
    });
  });

  it("handles nested objects", () => {
    const result = convertKeysToSnakeCase({
      connect: {
        runtime: {
          maxConnsPerProcess: 50,
          loadFactor: 0.5,
        },
      },
    });
    expect(result).toEqual({
      connect: {
        runtime: {
          max_conns_per_process: 50,
          load_factor: 0.5,
        },
      },
    });
  });

  it("handles arrays of objects", () => {
    const result = convertKeysToSnakeCase({
      integrationRequests: [{ authType: "oauth", guid: "abc-123" }],
    });
    expect(result).toEqual({
      integration_requests: [{ auth_type: "oauth", guid: "abc-123" }],
    });
  });

  it("preserves environment keys (user-defined)", () => {
    const result = convertKeysToSnakeCase({
      environment: {
        MY_API_KEY: "secret",
        DATABASE_URL: "postgres://...",
      },
    });
    expect(result).toEqual({
      environment: {
        MY_API_KEY: "secret",
        DATABASE_URL: "postgres://...",
      },
    });
  });

  it("preserves config keys inside integrationRequests", () => {
    const result = convertKeysToSnakeCase({
      integrationRequests: [
        {
          guid: "abc",
          config: {
            someCustomKey: "value",
            ANOTHER_KEY: "val2",
          },
        },
      ],
    });
    expect(result).toEqual({
      integration_requests: [
        {
          guid: "abc",
          config: {
            someCustomKey: "value",
            ANOTHER_KEY: "val2",
          },
        },
      ],
    });
  });

  it("passes through already-snake_case keys unchanged", () => {
    const result = convertKeysToSnakeCase({
      auth_type: "oauth",
      load_factor: 0.5,
      default_image_name: "posit/connect",
    });
    expect(result).toEqual({
      auth_type: "oauth",
      load_factor: 0.5,
      default_image_name: "posit/connect",
    });
  });

  it("handles null and primitive values", () => {
    expect(convertKeysToSnakeCase(null)).toBeNull();
    expect(convertKeysToSnakeCase(42)).toBe(42);
    expect(convertKeysToSnakeCase("hello")).toBe("hello");
    expect(convertKeysToSnakeCase(true)).toBe(true);
  });

  it("handles arrays of primitives", () => {
    const result = convertKeysToSnakeCase({
      files: ["app.py", "model.csv"],
    });
    expect(result).toEqual({
      files: ["app.py", "model.csv"],
    });
  });

  it("converts connectCloud nested keys", () => {
    const result = convertKeysToSnakeCase({
      connectCloud: {
        vanityName: "my-app",
        accessControl: {
          publicAccess: true,
          organizationAccess: "viewer",
        },
      },
    });
    expect(result).toEqual({
      connect_cloud: {
        vanity_name: "my-app",
        access_control: {
          public_access: true,
          organization_access: "viewer",
        },
      },
    });
  });

  it("roundtrips with convertKeysToCamelCase", () => {
    const original = {
      package_file: "requirements.txt",
      has_parameters: false,
      connect: {
        runtime: {
          max_conns_per_process: 50,
        },
        kubernetes: {
          default_image_name: "posit/connect",
        },
      },
      environment: {
        MY_KEY: "val",
      },
    };
    const camel = convertKeysToCamelCase(original);
    const snake = convertKeysToSnakeCase(camel);
    expect(snake).toEqual(original);
  });
});
