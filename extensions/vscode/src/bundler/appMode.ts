// Copyright (C) 2026 by Posit Software, PBC.

import { ContentType } from "../api/types/configurations";

// Maps deployment configuration ContentType values to Connect manifest appmode strings.
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

// Reverse mapping: Connect app_mode string → configuration ContentType string.
// Note: QUARTO and QUARTO_STATIC both map to "quarto-static"; the reverse
// map intentionally resolves to QUARTO.
const appModeToContentType: Record<string, string> = {
  static: ContentType.HTML,
  "jupyter-static": ContentType.JUPYTER_NOTEBOOK,
  "jupyter-voila": ContentType.JUPYTER_VOILA,
  "python-bokeh": ContentType.PYTHON_BOKEH,
  "python-dash": ContentType.PYTHON_DASH,
  "python-fastapi": ContentType.PYTHON_FASTAPI,
  "python-api": ContentType.PYTHON_FLASK,
  "python-shiny": ContentType.PYTHON_SHINY,
  "python-streamlit": ContentType.PYTHON_STREAMLIT,
  "python-gradio": ContentType.PYTHON_GRADIO,
  "python-panel": ContentType.PYTHON_PANEL,
  "quarto-shiny": ContentType.QUARTO_SHINY,
  "quarto-static": ContentType.QUARTO,
  api: ContentType.R_PLUMBER,
  shiny: ContentType.R_SHINY,
  "rmd-shiny": ContentType.RMD_SHINY,
  "rmd-static": ContentType.RMD,
};

export function contentTypeFromAppMode(appMode: string): string {
  return appModeToContentType[appMode] ?? appMode;
}
