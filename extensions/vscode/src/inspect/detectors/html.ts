// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import * as fs from "fs/promises";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "../types";
import { globDir } from "../helpers/globDir";
import { findLinkedResources } from "../helpers/resourceFinder";

export class StaticHTMLDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    if (entrypoint) {
      const ext = path.extname(entrypoint).toLowerCase();
      if (ext !== ".html" && ext !== ".htm") {
        return [];
      }
    }

    const configs: PartialConfig[] = [];

    const htmlFiles = await globDir(baseDir, "*.html");
    const htmFiles = await globDir(baseDir, "*.htm");
    const allFiles = [...htmlFiles, ...htmFiles];

    for (const entrypointPath of allFiles) {
      const relEntrypoint = path.basename(entrypointPath);
      if (entrypoint && relEntrypoint !== entrypoint) {
        continue;
      }

      const files = [`/${relEntrypoint}`];

      // Check for companion directories
      const stem = path.basename(relEntrypoint, path.extname(relEntrypoint));
      const extraDirs = ["_site", `${stem}_files`];
      for (const dirName of extraDirs) {
        const dirPath = path.join(baseDir, dirName);
        try {
          const stat = await fs.stat(dirPath);
          if (stat.isDirectory()) {
            files.push(`/${dirName}`);
          }
        } catch {
          // Directory doesn't exist
        }
      }

      const discoveredAssets = await findLinkedResources(baseDir, files);
      files.push(...discoveredAssets);

      configs.push({
        type: ContentType.HTML,
        entrypoint: relEntrypoint,
        files,
      });
    }
    return configs;
  }
}
