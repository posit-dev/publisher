// Copyright (C) 2026 by Posit Software, PBC.

// The two languages Connect can render a bare script (.R or .py) as a Quarto
// document (https://docs.posit.co/connect/user/scripts/). Both use
// ContentType.QUARTO_STATIC; the language determines the required
// frontmatter engine and language section.
export type ScriptLanguage = "r" | "python";

/**
 * Detect whether a bare R or Python script already has the Quarto
 * frontmatter block Connect requires to render it (see
 * https://quarto.org/docs/computations/render-scripts.html). R scripts use
 * roxygen-style `#'` comments; Python scripts use a `# %% [markdown]` cell.
 * In both cases the block must be delimited by a `---` line on each side.
 */
export function hasQuartoScriptFrontmatter(
  content: string,
  language: ScriptLanguage,
): boolean {
  const lines = content.split(/\r?\n/);
  return language === "r"
    ? hasRFrontmatter(lines)
    : hasPythonFrontmatter(lines);
}

function hasRFrontmatter(lines: string[]): boolean {
  let i = 0;
  while (i < lines.length && lines[i]?.trim() === "") {
    i++;
  }
  if (lines[i]?.trim() !== "#' ---") {
    return false;
  }
  for (i++; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (line === "#' ---") {
      return true;
    }
    if (!line.startsWith("#'")) {
      return false;
    }
  }
  return false;
}

function hasPythonFrontmatter(lines: string[]): boolean {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() !== "# %% [markdown]") {
      continue;
    }
    let sawOpen = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]?.trim() ?? "";
      if (!line.startsWith("#")) {
        break;
      }
      if (line === "# ---") {
        if (sawOpen) {
          return true;
        }
        sawOpen = true;
      }
    }
  }
  return false;
}

/**
 * Build the Quarto frontmatter block to prepend to a bare R or Python script
 * so Connect can render it (see hasQuartoScriptFrontmatter). Used only when
 * the user has chosen "Script" in the manual content-type picker and the
 * file doesn't already have this block.
 */
export function buildQuartoScriptFrontmatter(
  language: ScriptLanguage,
  title: string,
): string {
  const escapedTitle = title.replace(/"/g, '\\"');
  if (language === "r") {
    return `#' ---\n#' title: "${escapedTitle}"\n#' ---\n\n`;
  }
  return `# %% [markdown]\n# ---\n# title: "${escapedTitle}"\n# ---\n\n# %%\n\n`;
}
