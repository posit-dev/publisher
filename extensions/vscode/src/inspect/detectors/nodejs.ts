// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { fileExistsAt } from "src/interpreters/fsUtils";
import { ContentTypeDetector, PartialConfig } from "../types";
import { readMain, readPackageJson, readStart } from "../nodejs/packageJson";

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
