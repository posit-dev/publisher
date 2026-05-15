// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import {
  isRecord,
  readEnginesNode,
  readMain,
  readPackageJson,
  readStart,
} from "./packageJson";

describe("isRecord", () => {
  test("true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  test("false for null, arrays, primitives", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe("readPackageJson", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), "pkgjson-"));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  test("returns parsed object when valid JSON", async () => {
    await writeFile(
      path.join(baseDir, "package.json"),
      JSON.stringify({ name: "x" }),
      "utf-8",
    );
    expect(await readPackageJson(baseDir)).toEqual({ name: "x" });
  });

  test("returns undefined when package.json missing", async () => {
    expect(await readPackageJson(baseDir)).toBeUndefined();
  });

  test("returns undefined when package.json is invalid JSON", async () => {
    await writeFile(path.join(baseDir, "package.json"), "not { valid", "utf-8");
    expect(await readPackageJson(baseDir)).toBeUndefined();
  });
});

describe("readMain", () => {
  test("returns the string when main is a non-empty string", () => {
    expect(readMain({ main: "index.js" })).toBe("index.js");
  });

  test("returns undefined when main is empty", () => {
    expect(readMain({ main: "" })).toBeUndefined();
  });

  test("returns undefined when main is missing", () => {
    expect(readMain({})).toBeUndefined();
  });

  test("returns undefined when main is not a string", () => {
    expect(readMain({ main: 42 })).toBeUndefined();
    expect(readMain({ main: null })).toBeUndefined();
    expect(readMain({ main: ["a"] })).toBeUndefined();
  });

  test("returns undefined when input is not a record", () => {
    expect(readMain(null)).toBeUndefined();
    expect(readMain("string")).toBeUndefined();
    expect(readMain([])).toBeUndefined();
  });
});

describe("readStart", () => {
  test("returns the string when scripts.start is a non-empty string", () => {
    expect(readStart({ scripts: { start: "node app.js" } })).toBe(
      "node app.js",
    );
  });

  test("returns undefined when scripts.start is empty", () => {
    expect(readStart({ scripts: { start: "" } })).toBeUndefined();
  });

  test("returns undefined when scripts is missing", () => {
    expect(readStart({})).toBeUndefined();
  });

  test("returns undefined when scripts.start is missing", () => {
    expect(readStart({ scripts: { test: "vitest" } })).toBeUndefined();
  });

  test("returns undefined when scripts.start is not a string", () => {
    expect(readStart({ scripts: { start: 42 } })).toBeUndefined();
  });

  test("returns undefined when input is not a record", () => {
    expect(readStart(null)).toBeUndefined();
    expect(readStart("string")).toBeUndefined();
  });
});

describe("readEnginesNode", () => {
  test("returns the constraint when engines.node is a non-empty string", () => {
    expect(readEnginesNode({ engines: { node: ">=22.18.0" } })).toBe(
      ">=22.18.0",
    );
  });

  test("trims surrounding whitespace", () => {
    expect(readEnginesNode({ engines: { node: "  >=22.18.0  " } })).toBe(
      ">=22.18.0",
    );
  });

  test("returns undefined when engines is missing", () => {
    expect(readEnginesNode({ name: "x" })).toBeUndefined();
  });

  test("returns undefined when engines.node is missing", () => {
    expect(readEnginesNode({ engines: { npm: ">=10" } })).toBeUndefined();
  });

  test("returns undefined when engines.node is empty", () => {
    expect(readEnginesNode({ engines: { node: "" } })).toBeUndefined();
  });

  test("returns undefined when engines.node is only whitespace", () => {
    expect(readEnginesNode({ engines: { node: "   " } })).toBeUndefined();
  });

  test("returns undefined when engines.node is not a string", () => {
    expect(readEnginesNode({ engines: { node: 22 } })).toBeUndefined();
    expect(readEnginesNode({ engines: { node: null } })).toBeUndefined();
    expect(readEnginesNode({ engines: { node: [">=22"] } })).toBeUndefined();
  });

  test("returns undefined when input is not a record", () => {
    expect(readEnginesNode(null)).toBeUndefined();
    expect(readEnginesNode("string")).toBeUndefined();
    expect(readEnginesNode([])).toBeUndefined();
  });
});
