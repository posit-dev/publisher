// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import {
  allValidContentTypes,
  ContentType,
} from "src/api/types/configurations";
import { ScriptLanguage } from "./index";

// Content types the manual picker suggests first for a given entrypoint
// extension, ranked by likelihood, plus (for .R/.r and .py) the language to
// use for the "Script" entry. Extensions not listed here get no "Suggested"
// group; every type still appears under "All content types" regardless.
export const suggestedContentTypesByExtension: Partial<
  Record<string, { script?: ScriptLanguage; types: ContentType[] }>
> = {
  ".r": {
    script: "r",
    types: [ContentType.R_SHINY, ContentType.R_PLUMBER],
  },
  ".py": {
    script: "python",
    types: [
      ContentType.PYTHON_SHINY,
      ContentType.PYTHON_STREAMLIT,
      ContentType.PYTHON_DASH,
      ContentType.PYTHON_FASTAPI,
      ContentType.PYTHON_FLASK,
      ContentType.PYTHON_BOKEH,
      ContentType.PYTHON_GRADIO,
      ContentType.PYTHON_PANEL,
    ],
  },
  ".ipynb": {
    types: [
      ContentType.JUPYTER_NOTEBOOK,
      ContentType.JUPYTER_VOILA,
      ContentType.QUARTO_STATIC,
    ],
  },
  ".qmd": {
    types: [ContentType.QUARTO_STATIC, ContentType.QUARTO_SHINY],
  },
  ".rmd": {
    types: [ContentType.RMD, ContentType.RMD_SHINY],
  },
  ".html": { types: [ContentType.HTML] },
  ".htm": { types: [ContentType.HTML] },
  ".js": { types: [ContentType.NODEJS] },
  ".ts": { types: [ContentType.NODEJS] },
  ".md": { types: [ContentType.QUARTO_STATIC] },
};

// Content types the manual picker offers as choices. ContentType.QUARTO is
// excluded: it is a legacy alias for ContentType.QUARTO_STATIC (both map to
// Connect's "quarto-static" app mode, see bundler/appMode.ts) kept only so
// old configs still parse, never as something to newly write.
export const manualContentTypeChoices = allValidContentTypes.filter(
  (type) => type !== ContentType.QUARTO,
);

export type ManualContentTypeEntry =
  | { kind: "separator"; label: string }
  | { kind: "script"; language: ScriptLanguage }
  | { kind: "type"; contentType: ContentType };

/**
 * Plans the manual content-type picker's items for a given entrypoint file:
 * which content types (and, where applicable, the "Script" entry) to rank
 * under a "Suggested" group, and the rest under "All content types". Pure
 * planning only — callers turn each entry into an actual quick pick item,
 * since that requires async content-type inspection.
 */
export function planManualContentTypeItems(
  entrypointFile: string,
): ManualContentTypeEntry[] {
  const ext = path.extname(entrypointFile).toLowerCase();
  const suggestion = suggestedContentTypesByExtension[ext];

  if (!suggestion) {
    return manualContentTypeChoices.map((contentType) => ({
      kind: "type",
      contentType,
    }));
  }

  const suggestedTypes = new Set(suggestion.types);
  const entries: ManualContentTypeEntry[] = [
    { kind: "separator", label: `Suggested for ${entrypointFile}` },
  ];
  if (suggestion.script) {
    entries.push({ kind: "script", language: suggestion.script });
    // The generic "Quarto Document" type entry (inspectManualContentType)
    // writes a [quarto] section with no engine and no [python]/[r] section,
    // which Connect can't render for a bare script. The "Script" entry above
    // (inspectManualScript) is the only correct way to render this
    // entrypoint with Quarto, so don't also offer the generic type below.
    suggestedTypes.add(ContentType.QUARTO_STATIC);
  }
  for (const contentType of suggestion.types) {
    entries.push({ kind: "type", contentType });
  }

  entries.push({ kind: "separator", label: "All content types" });
  for (const contentType of manualContentTypeChoices) {
    if (!suggestedTypes.has(contentType)) {
      entries.push({ kind: "type", contentType });
    }
  }

  return entries;
}
