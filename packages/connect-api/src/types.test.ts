// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import {
  ContentName,
  Int64Str,
  CloudAuthToken,
  CloudEnvironment,
} from "./types.js";

describe("ContentName branded type", () => {
  it("creates a branded ContentName from a string", () => {
    const name = ContentName("my-app");
    expect(name).toBe("my-app");
  });

  it("preserves the original string value", () => {
    const name = ContentName("dashboard_v2");
    expect(name.length).toBe(12);
    expect(name.startsWith("dashboard")).toBe(true);
  });
});

describe("Int64Str branded type", () => {
  it("creates a branded Int64Str from a numeric string", () => {
    const val = Int64Str("9223372036854775807");
    expect(val).toBe("9223372036854775807");
  });

  it("preserves the string representation", () => {
    const val = Int64Str("42");
    expect(val).toBe("42");
  });
});

describe("CloudAuthToken branded type", () => {
  it("creates a branded CloudAuthToken from a string", () => {
    const token = CloudAuthToken("eyJhbGciOiJIUzI1NiJ9.test");
    expect(token).toBe("eyJhbGciOiJIUzI1NiJ9.test");
  });
});

describe("CloudEnvironment enum", () => {
  it("has a Development value matching the Go constant", () => {
    expect(CloudEnvironment.Development).toBe("development");
  });

  it("has a Staging value matching the Go constant", () => {
    expect(CloudEnvironment.Staging).toBe("staging");
  });

  it("has a Production value matching the Go constant", () => {
    expect(CloudEnvironment.Production).toBe("production");
  });

  it("has exactly three members", () => {
    const values = Object.values(CloudEnvironment);
    expect(values).toHaveLength(3);
    expect(values).toEqual(
      expect.arrayContaining(["development", "staging", "production"]),
    );
  });
});
