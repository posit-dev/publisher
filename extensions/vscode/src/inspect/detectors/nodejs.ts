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

function hasValidExtension(filePath: string): boolean {
  return VALID_EXTENSIONS.has(path.extname(filePath));
}

function toRelForwardSlash(baseDir: string, abs: string): string {
  return path.relative(baseDir, abs).split(path.sep).join("/");
}

function makeConfig(baseDir: string, abs: string): PartialConfig {
  return {
    type: ContentType.NODEJS,
    entrypoint: toRelForwardSlash(baseDir, abs),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readMain(pkg: unknown): string | undefined {
  if (!isRecord(pkg)) return undefined;
  const main = pkg.main;
  if (typeof main !== "string" || main.length === 0) return undefined;
  return main;
}

async function readPackageJson(baseDir: string): Promise<unknown | undefined> {
  const text = await readFileText(path.join(baseDir, "package.json"));
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

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

    return [];
  }
}
