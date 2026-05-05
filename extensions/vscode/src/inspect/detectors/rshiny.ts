// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import * as fs from "fs/promises";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "../types";

const possibleEntrypoints = ["app.R", "server.R"];

export class RShinyDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    if (entrypoint) {
      if (!entrypoint.endsWith(".R")) {
        return [];
      }
    }

    const configs: PartialConfig[] = [];
    for (const relEntrypoint of possibleEntrypoints) {
      if (entrypoint && relEntrypoint !== entrypoint) {
        continue;
      }
      const fullPath = path.join(baseDir, relEntrypoint);
      try {
        await fs.access(fullPath);
      } catch {
        continue;
      }
      configs.push({
        type: ContentType.R_SHINY,
        entrypoint: relEntrypoint,
        r: {},
      });
    }
    return configs;
  }
}
