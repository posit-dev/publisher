// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { expandInlineArrays } from "./tomlHelpers";

describe("expandInlineArrays", () => {
  it("expands a simple string array", () => {
    const input = 'files = ["app.py", "requirements.txt"]\n';
    const expected = [
      "files = [",
      '    "app.py",',
      '    "requirements.txt",',
      "]",
      "",
    ].join("\n");
    expect(expandInlineArrays(input)).toBe(expected);
  });

  it("expands multiple arrays independently", () => {
    const input = [
      'type = "python-dash"',
      'files = ["app.py", "requirements.txt"]',
      'secrets = ["API_KEY", "DB_PASS"]',
    ].join("\n");
    const expected = [
      'type = "python-dash"',
      "files = [",
      '    "app.py",',
      '    "requirements.txt",',
      "]",
      "secrets = [",
      '    "API_KEY",',
      '    "DB_PASS",',
      "]",
    ].join("\n");
    expect(expandInlineArrays(input)).toBe(expected);
  });

  it("leaves empty arrays untouched", () => {
    const input = "files = []\n";
    expect(expandInlineArrays(input)).toBe(input);
  });

  it("leaves scalar values untouched", () => {
    const input = 'type = "python-dash"\nversion = "3.11"\n';
    expect(expandInlineArrays(input)).toBe(input);
  });

  it("handles strings containing commas", () => {
    const input = 'files = ["hello, world.txt", "other.py"]\n';
    const expected = [
      "files = [",
      '    "hello, world.txt",',
      '    "other.py",',
      "]",
      "",
    ].join("\n");
    expect(expandInlineArrays(input)).toBe(expected);
  });

  it("handles strings containing escaped quotes", () => {
    const input = 'files = ["say \\"hi\\"", "other.py"]\n';
    const expected = [
      "files = [",
      '    "say \\"hi\\"",',
      '    "other.py",',
      "]",
      "",
    ].join("\n");
    expect(expandInlineArrays(input)).toBe(expected);
  });

  it("handles numeric arrays", () => {
    const input = "values = [1, 2, 3]\n";
    const expected = ["values = [", "    1,", "    2,", "    3,", "]", ""].join(
      "\n",
    );
    expect(expandInlineArrays(input)).toBe(expected);
  });

  it("handles single-element arrays", () => {
    const input = 'files = ["app.py"]\n';
    const expected = ["files = [", '    "app.py",', "]", ""].join("\n");
    expect(expandInlineArrays(input)).toBe(expected);
  });

  it("does not touch section headers with brackets", () => {
    const input = "[python]\n";
    expect(expandInlineArrays(input)).toBe(input);
  });

  it("does not touch array-of-tables headers", () => {
    const input = "[[integration_requests]]\n";
    expect(expandInlineArrays(input)).toBe(input);
  });

  it("respects custom indent", () => {
    const input = 'files = ["a.py", "b.py"]\n';
    const expected = ["files = [", '\t"a.py",', '\t"b.py",', "]", ""].join(
      "\n",
    );
    expect(expandInlineArrays(input, "\t")).toBe(expected);
  });

  it("handles strings containing closing brackets", () => {
    const input = 'patterns = ["[a-z]", "[0-9]+"]\n';
    const expected = [
      "patterns = [",
      '    "[a-z]",',
      '    "[0-9]+",',
      "]",
      "",
    ].join("\n");
    expect(expandInlineArrays(input)).toBe(expected);
  });

  it("preserves surrounding content", () => {
    const input = [
      '"$schema" = "https://example.com/schema.json"',
      'type = "python-dash"',
      'entrypoint = "app.py"',
      'files = ["app.py", "requirements.txt"]',
      "",
      "[python]",
      'version = "3.11.3"',
      "",
    ].join("\n");
    const expected = [
      '"$schema" = "https://example.com/schema.json"',
      'type = "python-dash"',
      'entrypoint = "app.py"',
      "files = [",
      '    "app.py",',
      '    "requirements.txt",',
      "]",
      "",
      "[python]",
      'version = "3.11.3"',
      "",
    ].join("\n");
    expect(expandInlineArrays(input)).toBe(expected);
  });
});
