// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { ContentName, Int64Str } from "./types.js";

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
