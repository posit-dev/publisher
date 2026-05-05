// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "../types";
import { globDir } from "../helpers/globDir";
import { hasPythonImports } from "../helpers/pythonImports";

const shinyExpressImportRE =
  /(import\s+shiny.express)|(from\s+shiny.express\s+import)|(from\s+shiny\s+import.*\bexpress\b)/;

const invalidPythonIdentifierRE = /(^[0-9]|[^A-Za-z0-9])/g;

export function hasShinyExpressImport(content: string): boolean {
  return shinyExpressImportRE.test(content);
}

function shinyExpressEntrypoint(entrypoint: string): string {
  const safeEntrypoint = entrypoint.replace(
    invalidPythonIdentifierRE,
    (match) => {
      return `_${match.charCodeAt(0).toString(16)}_`;
    },
  );
  return "shiny.express.app:" + safeEntrypoint;
}

export class PyShinyDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    if (entrypoint) {
      if (!entrypoint.endsWith(".py")) {
        return [];
      }
    }

    const configs: PartialConfig[] = [];
    const pyFiles = await globDir(baseDir, "*.py");

    for (const filePath of pyFiles) {
      const relEntrypoint = path.basename(filePath);
      if (entrypoint && relEntrypoint !== entrypoint) {
        continue;
      }

      const content = await fs.readFile(filePath, "utf-8");
      if (!hasPythonImports(content, ["shiny"])) {
        continue;
      }

      const isExpress = hasShinyExpressImport(content);

      const config: PartialConfig = {
        type: ContentType.PYTHON_SHINY,
        entrypoint: relEntrypoint,
        files: [`/${relEntrypoint}`],
        python: {},
      };

      if (isExpress) {
        config.entrypointObjectRef = shinyExpressEntrypoint(relEntrypoint);
      }

      configs.push(config);
    }
    return configs;
  }
}
