// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";

import { logger } from "src/logging";

import { globDir } from "./globDir";

// Matches fenced code blocks with {r} or {python} language identifiers,
// inline code evaluation syntax (`r expr` or `python expr`),
// and Quarto-style inline code (`{r} expr` or `{python} expr`).
// Handles both ``` and ~~~ fencing, and optional chunk options.
const rCodeRE = /^[ \t]*(```+|~~~+)\s*\{r[\s,}]|`r |`\{r\} /m;
const pythonCodeRE =
  /^[ \t]*(```+|~~~+)\s*\{python[\s,}]|`python |`\{python\} /m;

/**
 * Detect whether markdown content contains R and/or Python code blocks.
 * Used by Quarto and RMarkdown detectors to determine language requirements.
 */
export function detectMarkdownLanguagesInContent(content: string): {
  needsR: boolean;
  needsPython: boolean;
} {
  return {
    needsR: rCodeRE.test(content),
    needsPython: pythonCodeRE.test(content),
  };
}

/**
 * Scan all *.Rmd files in a directory for R and/or Python code blocks.
 * Returns true for needsR/needsPython if ANY file contains matching blocks.
 * Short-circuits once both languages are detected.
 */
export async function detectMarkdownLanguagesInDirectory(
  baseDir: string,
): Promise<{ needsR: boolean; needsPython: boolean }> {
  let needsR = false;
  let needsPython = false;

  const files = await globDir(baseDir, "*.Rmd");

  for (const filePath of files) {
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (err: unknown) {
      logger.warn(
        `[markdownLanguages] could not read file ${filePath}: ${err}`,
      );
      continue;
    }

    const result = detectMarkdownLanguagesInContent(content);
    needsR = needsR || result.needsR;
    needsPython = needsPython || result.needsPython;

    if (needsR && needsPython) {
      break;
    }
  }

  logger.debug(
    `[markdownLanguages] directory scan result: needsR=${needsR}, needsPython=${needsPython}`,
  );
  return { needsR, needsPython };
}
