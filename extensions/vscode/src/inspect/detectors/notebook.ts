// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "../types";
import { globDir } from "../helpers/globDir";
import { getNotebookCodeInputs } from "../helpers/notebookContents";
import { hasPythonImports } from "../helpers/pythonImports";

const voilaImportNames = [
  "ipywidgets",
  // From the Voila example notebooks
  "bqplot",
  "ipympl",
  "ipyvolume",
  // Other widget packages from PyPI
  "ipyspeck",
  "ipywebgl",
  "ipywebrtc",
];

export class NotebookDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    if (entrypoint) {
      if (!entrypoint.endsWith(".ipynb")) {
        return [];
      }
    }

    const configs: PartialConfig[] = [];
    const notebookFiles = await globDir(baseDir, "*.ipynb");

    for (const filePath of notebookFiles) {
      const relEntrypoint = path.basename(filePath);
      if (entrypoint && relEntrypoint !== entrypoint) {
        continue;
      }

      let code: string;
      try {
        code = await getNotebookCodeInputs(filePath);
      } catch {
        // Empty or invalid notebooks are skipped
        continue;
      }

      if (code === "") {
        // Empty notebooks are not valid
        continue;
      }

      const isVoila = hasPythonImports(code, voilaImportNames);
      const type = isVoila
        ? ContentType.JUPYTER_VOILA
        : ContentType.JUPYTER_NOTEBOOK;

      configs.push({
        type,
        entrypoint: relEntrypoint,
        python: {},
      });
    }
    return configs;
  }
}
