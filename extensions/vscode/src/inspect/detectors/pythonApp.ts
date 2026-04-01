// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "../types";
import { globDir } from "../helpers/globDir";
import { fileHasPythonImports } from "../helpers/pythonImports";

/**
 * Generic Python framework detector parameterized by content type and import list.
 */
export class PythonAppDetector implements ContentTypeDetector {
  constructor(
    private contentType: ContentType,
    private imports: string[],
  ) {}

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
      const matches = await fileHasPythonImports(filePath, this.imports);
      if (matches) {
        configs.push({
          type: this.contentType,
          entrypoint: relEntrypoint,
          python: {},
        });
      }
    }
    return configs;
  }
}

export function newFlaskDetector(): PythonAppDetector {
  return new PythonAppDetector(ContentType.PYTHON_FLASK, [
    "flask", // also matches flask_api, flask_openapi3, etc.
    "flasgger",
    "falcon", // must check for this after falcon.asgi (FastAPI)
    "bottle",
    "pycnic",
  ]);
}

export function newFastAPIDetector(): PythonAppDetector {
  return new PythonAppDetector(ContentType.PYTHON_FASTAPI, [
    "fastapi",
    "falcon.asgi",
    "quart",
    "sanic",
    "starlette",
    "vetiver",
  ]);
}

export function newDashDetector(): PythonAppDetector {
  return new PythonAppDetector(ContentType.PYTHON_DASH, [
    "dash", // also matches dash_core_components, dash_bio, etc.
  ]);
}

export function newGradioDetector(): PythonAppDetector {
  return new PythonAppDetector(ContentType.PYTHON_GRADIO, ["gradio"]);
}

export function newPanelDetector(): PythonAppDetector {
  return new PythonAppDetector(ContentType.PYTHON_PANEL, ["panel"]);
}

export function newStreamlitDetector(): PythonAppDetector {
  return new PythonAppDetector(ContentType.PYTHON_STREAMLIT, ["streamlit"]);
}

export function newBokehDetector(): PythonAppDetector {
  return new PythonAppDetector(ContentType.PYTHON_BOKEH, ["bokeh"]);
}
