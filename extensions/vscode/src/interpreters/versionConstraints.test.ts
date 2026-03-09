// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  adaptPythonRequires,
  adaptToCompatibleConstraint,
} from "./versionConstraints";

describe("adaptPythonRequires", () => {
  const cases: Array<{ input: string; expected: string | null }> = [
    { input: "3.9.17", expected: "~=3.9.0" },
    { input: ">=3.7", expected: ">=3.7" },
    { input: "==3.11.*", expected: "==3.11.*" },
    { input: "3.8.0", expected: "~=3.8.0" },
    { input: "3.11.10", expected: "~=3.11.0" },
    { input: "3.11", expected: "~=3.11.0" },
    { input: "3.11.0", expected: "~=3.11.0" },
    { input: "3", expected: "~=3.0" },
    { input: "3.0", expected: "~=3.0.0" },
    { input: "3.0.0", expected: "~=3.0.0" },
    { input: "3.8.*", expected: "==3.8.*" },
    { input: "  3.9.0  ", expected: "~=3.9.0" },
    { input: "~=3.10", expected: "~=3.10" },
    { input: "< 4.0", expected: "< 4.0" },
    // Pre-release and special implementations are rejected
    { input: "3.10rc1", expected: null },
    { input: "3.11b2", expected: null },
    { input: "3.8a1", expected: null },
    { input: "cpython-3.8", expected: null },
    { input: "3.9/pypy", expected: null },
    { input: "3.10@foo", expected: null },
    // Invalid versions
    { input: "", expected: null },
    { input: "abc", expected: null },
    { input: "3..8", expected: null },
    { input: "3.8.1.*", expected: null },
  ];

  cases.forEach(({ input, expected }) => {
    test(`"${input}" -> ${expected === null ? "null" : `"${expected}"`}`, () => {
      expect(adaptPythonRequires(input)).toBe(expected);
    });
  });
});

describe("adaptToCompatibleConstraint", () => {
  test("major only", () => {
    expect(adaptToCompatibleConstraint("3")).toBe("~=3.0");
  });

  test("major.minor", () => {
    expect(adaptToCompatibleConstraint("3.8")).toBe("~=3.8.0");
  });

  test("major.minor.patch", () => {
    expect(adaptToCompatibleConstraint("3.8.11")).toBe("~=3.8.0");
  });

  test("major.minor.patch (zeroes)", () => {
    expect(adaptToCompatibleConstraint("4.3.0")).toBe("~=4.3.0");
  });
});
