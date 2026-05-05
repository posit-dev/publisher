// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { fileExistsAt } from "src/interpreters/fsUtils";
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

    return [];
  }
}
