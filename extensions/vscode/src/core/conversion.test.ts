// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { convertKeysToCamelCase } from "./conversion";

describe("convertKeysToCamelCase", () => {
  test("converts simple snake_case keys", () => {
    const input = { package_file: "requirements.txt", package_manager: "pip" };
    expect(convertKeysToCamelCase(input)).toEqual({
      packageFile: "requirements.txt",
      packageManager: "pip",
    });
  });

  test("leaves already-camelCase keys unchanged", () => {
    const input = { version: "3.11", entrypoint: "app.py" };
    expect(convertKeysToCamelCase(input)).toEqual({
      version: "3.11",
      entrypoint: "app.py",
    });
  });

  test("converts nested objects", () => {
    const input = {
      python: {
        package_file: "requirements.txt",
        package_manager: "pip",
      },
      connect: {
        runtime: {
          connection_timeout: 5,
          max_conns_per_process: 50,
        },
      },
    };
    expect(convertKeysToCamelCase(input)).toEqual({
      python: {
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
      connect: {
        runtime: {
          connectionTimeout: 5,
          maxConnsPerProcess: 50,
        },
      },
    });
  });

  test("converts arrays of objects", () => {
    const input = {
      integration_requests: [
        { auth_type: "oauth", display_name: "Test" },
        { auth_type: "api_key", display_name: "Other" },
      ],
    };
    expect(convertKeysToCamelCase(input)).toEqual({
      integrationRequests: [
        { authType: "oauth", displayName: "Test" },
        { authType: "api_key", displayName: "Other" },
      ],
    });
  });

  test("preserves environment keys without conversion", () => {
    const input = {
      environment: {
        MY_API_KEY: "value1",
        DATABASE_URL: "postgres://localhost",
        simple: "value2",
      },
    };
    expect(convertKeysToCamelCase(input)).toEqual({
      environment: {
        MY_API_KEY: "value1",
        DATABASE_URL: "postgres://localhost",
        simple: "value2",
      },
    });
  });

  test("handles primitive values", () => {
    expect(convertKeysToCamelCase("hello")).toBe("hello");
    expect(convertKeysToCamelCase(42)).toBe(42);
    expect(convertKeysToCamelCase(true)).toBe(true);
    expect(convertKeysToCamelCase(null)).toBe(null);
  });

  test("handles arrays of primitives", () => {
    const input = { files: ["app.py", "model.csv"] };
    expect(convertKeysToCamelCase(input)).toEqual({
      files: ["app.py", "model.csv"],
    });
  });

  test("converts product_type to productType", () => {
    const input = { product_type: "connect", $schema: "https://example.com" };
    expect(convertKeysToCamelCase(input)).toEqual({
      productType: "connect",
      $schema: "https://example.com",
    });
  });

  test("converts connect_cloud nested structure", () => {
    const input = {
      connect_cloud: {
        vanity_name: "my-app",
        access_control: {
          public_access: true,
          organization_access: "viewer",
        },
      },
    };
    expect(convertKeysToCamelCase(input)).toEqual({
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
