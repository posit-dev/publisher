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
 * In both cases the block must be delimited by a `---` line on each side,
 * and must be the first thing in the script (after an optional shebang line
 * and/or blank lines) — a later, unrelated comment block that happens to be
 * delimited by `---` lines doesn't count as Quarto frontmatter.
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

// A shebang, if present, must be the very first line to have any effect, so
// only skip it there — not after leading blank lines.
function skipShebang(lines: string[]): number {
  return lines[0]?.startsWith("#!") ? 1 : 0;
}

function skipBlankLines(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i]?.trim() === "") {
    i++;
  }
  return i;
}

function hasRFrontmatter(lines: string[]): boolean {
  let i = skipBlankLines(lines, skipShebang(lines));
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
  const start = skipBlankLines(lines, skipShebang(lines));
  if (lines[start]?.trim() !== "# %% [markdown]") {
    return false;
  }
  let sawOpen = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("#")) {
      return false;
    }
    if (line === "# ---") {
      if (sawOpen) {
        return true;
      }
      sawOpen = true;
    }
  }
  return false;
}

/**
 * Build the Quarto frontmatter block to prepend to a bare R or Python script
 * so Connect can render it (see hasQuartoScriptFrontmatter).
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

/**
 * Insert the Quarto frontmatter block into a script's contents (see
 * buildQuartoScriptFrontmatter). Used only when the user has chosen "Script"
 * in the manual content-type picker and the file doesn't already have this
 * block. A shebang line, if present, must stay on line 1 to keep working
 * when the script is run directly (`./script.py`), so the frontmatter is
 * inserted after it rather than above it.
 */
export function insertQuartoScriptFrontmatter(
  content: string,
  language: ScriptLanguage,
  title: string,
): string {
  const frontmatter = buildQuartoScriptFrontmatter(language, title);
  const newlineIdx = content.indexOf("\n");
  const firstLine = newlineIdx === -1 ? content : content.slice(0, newlineIdx);
  if (!firstLine.startsWith("#!")) {
    return frontmatter + content;
  }
  const rest = newlineIdx === -1 ? "" : content.slice(newlineIdx + 1);
  return `${firstLine}\n${frontmatter}${rest}`;
}
