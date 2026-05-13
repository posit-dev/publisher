// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";

import { readFileText } from "src/interpreters/fsUtils";

/** Type guard narrowing parsed JSON to a plain object before field access. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Read and parse `<baseDir>/package.json`. Returns `undefined` when the file
 * is missing or unparseable so callers treat both as "no package.json signal".
 */
export async function readPackageJson(baseDir: string): Promise<unknown> {
  const text = await readFileText(path.join(baseDir, "package.json"));
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Read a non-empty string `main` field from a parsed package.json, or
 * `undefined` if absent or not a usable string.
 */
export function readMain(pkg: unknown): string | undefined {
  if (!isRecord(pkg)) return undefined;
  const main = pkg.main;
  if (typeof main !== "string" || main.length === 0) return undefined;
  return main;
}

/**
 * Read a non-empty `scripts.start` string from a parsed package.json, or
 * `undefined` if absent or not a usable string.
 */
export function readStart(pkg: unknown): string | undefined {
  if (!isRecord(pkg)) return undefined;
  const scripts = pkg.scripts;
  if (!isRecord(scripts)) return undefined;
  const start = scripts.start;
  if (typeof start !== "string" || start.length === 0) return undefined;
  return start;
}

/**
 * Read the `engines.node` version constraint from a parsed package.json.
 * Returns the trimmed constraint string when present and non-empty.
 * Returns `undefined` for anything else. Used by the publish-time log to
 * surface the runtime constraint Connect will read at deploy time.
 */
export function readEnginesNode(pkg: unknown): string | undefined {
  if (!isRecord(pkg)) return undefined;
  const engines = pkg.engines;
  if (!isRecord(engines)) return undefined;
  const node = engines.node;
  if (typeof node !== "string") return undefined;
  const trimmed = node.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
