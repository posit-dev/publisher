// Copyright (C) 2026 by Posit Software, PBC.

// Matches fenced code blocks with {r} or {python} language identifiers.
// Handles both ``` and ~~~ fencing, and optional chunk options.
const rCodeBlockRE = /^[ \t]*```+\s*\{r[\s,}]/m;
const pythonCodeBlockRE = /^[ \t]*```+\s*\{python[\s,}]/m;

/**
 * Detect whether markdown content contains R and/or Python code blocks.
 * Used by Quarto and RMarkdown detectors to determine language requirements.
 */
export function detectMarkdownLanguagesInContent(content: string): {
  needsR: boolean;
  needsPython: boolean;
} {
  return {
    needsR: rCodeBlockRE.test(content),
    needsPython: pythonCodeBlockRE.test(content),
  };
}
