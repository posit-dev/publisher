// Copyright (C) 2026 by Posit Software, PBC.

import { ContentType } from "../api/types/configurations";

// Maps deployment configuration ContentType values to Connect manifest appmode strings.
// Mirrors the Go connectContentTypeMap in internal/clients/types/apptypes.go.
const connectContentTypeMap: Record<string, string> = {
  [ContentType.HTML]: "static",
  [ContentType.JUPYTER_NOTEBOOK]: "jupyter-static",
  [ContentType.JUPYTER_VOILA]: "jupyter-voila",
  [ContentType.PYTHON_BOKEH]: "python-bokeh",
  [ContentType.PYTHON_DASH]: "python-dash",
  [ContentType.PYTHON_FASTAPI]: "python-fastapi",
  [ContentType.PYTHON_FLASK]: "python-api",
  [ContentType.PYTHON_SHINY]: "python-shiny",
  [ContentType.PYTHON_STREAMLIT]: "python-streamlit",
  [ContentType.PYTHON_GRADIO]: "python-gradio",
  [ContentType.PYTHON_PANEL]: "python-panel",
  [ContentType.QUARTO_SHINY]: "quarto-shiny",
  [ContentType.QUARTO]: "quarto-static",
  [ContentType.QUARTO_STATIC]: "quarto-static",
  [ContentType.R_PLUMBER]: "api",
  [ContentType.R_SHINY]: "shiny",
  [ContentType.RMD_SHINY]: "rmd-shiny",
  [ContentType.RMD]: "rmd-static",
};

export function appModeFromType(contentType: string): string {
  return connectContentTypeMap[contentType] ?? contentType;
}
