// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { fileExistsAt, readFileText } from "src/interpreters/fsUtils";
import { ContentTypeDetector, PartialConfig } from "../types";

const VALID_EXTENSIONS: ReadonlySet<string> = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".mts",
  ".cts",
]);

const FALLBACK_FILES: readonly string[] = [
  "server.js",
  "app.js",
  "index.js",
  "server.ts",
  "app.ts",
  "index.ts",
];

/** True if `filePath` ends with a Node.js source extension we can detect. */
function hasValidExtension(filePath: string): boolean {
  return VALID_EXTENSIONS.has(path.extname(filePath));
}

/**
 * Convert an absolute path to a baseDir-relative path with forward slashes,
 * regardless of host platform — entrypoints are persisted in TOML and must be
 * portable across macOS, Linux, and Windows.
 */
function toRelForwardSlash(baseDir: string, abs: string): string {
  return path.relative(baseDir, abs).split(path.sep).join("/");
}

/** Build the detector's output for a resolved Node.js entrypoint. */
function makeConfig(baseDir: string, abs: string): PartialConfig {
  return {
    type: ContentType.NODEJS,
    entrypoint: toRelForwardSlash(baseDir, abs),
  };
}

/** Type guard narrowing parsed JSON to a plain object before field access. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Read a non-empty string `main` field from a parsed package.json, or
 * `undefined` if absent or not a usable string.
 */
function readMain(pkg: unknown): string | undefined {
  if (!isRecord(pkg)) return undefined;
  const main = pkg.main;
  if (typeof main !== "string" || main.length === 0) return undefined;
  return main;
}

/**
 * Read a non-empty `scripts.start` string from a parsed package.json, or
 * `undefined` if absent or not a usable string.
 */
function readStart(pkg: unknown): string | undefined {
  if (!isRecord(pkg)) return undefined;
  const scripts = pkg.scripts;
  if (!isRecord(scripts)) return undefined;
  const start = scripts.start;
  if (typeof start !== "string" || start.length === 0) return undefined;
  return start;
}

/**
 * Find the script file in a `scripts.start` command. Locates `node` (with a
 * word boundary so `ts-node` also matches — Connect parity, see test) and
 * returns the first following non-flag argument with a valid extension.
 * Returns `undefined` if no matching argument is found.
 */
function parseStartScript(start: string): string | undefined {
  const match = start.match(/\bnode\s+(.+)/);
  const rest = match?.[1];
  if (rest === undefined) return undefined;
  const args = rest.trim().split(/\s+/);
  return args.find((a) => !a.startsWith("-") && hasValidExtension(a));
}

/**
 * Read and parse `<baseDir>/package.json`. Returns `undefined` when the file
 * is missing or unparseable so the caller treats both as "no package.json
 * signal" — Connect's runtime warns and falls through, but in detection we
 * prefer Unknown over guessing.
 */
async function readPackageJson(baseDir: string): Promise<unknown> {
  const text = await readFileText(path.join(baseDir, "package.json"));
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Resolve a relative path against `baseDir` and return the absolute path if
 * the file exists, otherwise `undefined`.
 */
async function resolveCandidate(
  baseDir: string,
  candidate: string,
): Promise<string | undefined> {
  const abs = path.resolve(baseDir, candidate);
  return (await fileExistsAt(abs)) ? abs : undefined;
}

export class NodejsAppDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    if (entrypoint !== undefined) {
      if (!hasValidExtension(entrypoint)) {
        return [];
      }
      const resolved = path.resolve(baseDir, entrypoint);
      if (!(await fileExistsAt(resolved))) {
        return [];
      }
      return [makeConfig(baseDir, resolved)];
    }

    const pkg = await readPackageJson(baseDir);
    if (pkg === undefined) {
      return [];
    }

    const main = readMain(pkg);
    if (main !== undefined) {
      const resolved = await resolveCandidate(baseDir, main);
      if (resolved !== undefined) {
        return [makeConfig(baseDir, resolved)];
      }
    }

    const start = readStart(pkg);
    if (start !== undefined) {
      const candidate = parseStartScript(start);
      if (candidate !== undefined) {
        const resolved = await resolveCandidate(baseDir, candidate);
        if (resolved !== undefined) {
          return [makeConfig(baseDir, resolved)];
        }
      }
    }

    for (const name of FALLBACK_FILES) {
      const resolved = await resolveCandidate(baseDir, name);
      if (resolved !== undefined) {
        return [makeConfig(baseDir, resolved)];
      }
    }

    return [];
  }
}
