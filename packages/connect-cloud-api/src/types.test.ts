// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { CloudAuthToken } from "./types.js";

describe("CloudAuthToken branded type", () => {
  it("creates a branded CloudAuthToken from a string", () => {
    const token = CloudAuthToken("my-secret-token");
    expect(token).toBe("my-secret-token");
  });

  it("preserves the original string value", () => {
    const token = CloudAuthToken("abc123");
    expect(token.length).toBe(6);
    expect(token.startsWith("abc")).toBe(true);
  });
});
