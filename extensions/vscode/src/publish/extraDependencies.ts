// Copyright (C) 2026 by Posit Software, PBC.

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

import { ContentType } from "../api/types/configurations";
import { fileExistsAt } from "../interpreters/fsUtils";

const PLUMBER_SERVER_FILES = ["_server.yml", "_server.yaml"];

/**
 * Return implicit R package dependencies for content types where renv
 * may not discover them from user code alone.
 *
 * For example, a Shiny app may not explicitly call `library("shiny")`,
 * but the deployment still needs the shiny package.
 *
 * For Plumber content, reads `_server.yml` / `_server.yaml` to determine
 * the engine (plumber vs plumber2).
 */
export async function findExtraDependencies(
  contentType: ContentType,
  hasParameters: boolean | undefined,
  projectDir: string,
): Promise<string[]> {
  switch (contentType) {
    case ContentType.RMD_SHINY:
    case ContentType.QUARTO_SHINY:
      return ["shiny", "rmarkdown"];

    case ContentType.QUARTO:
    case ContentType.QUARTO_STATIC:
    case ContentType.RMD:
      return hasParameters ? ["rmarkdown", "shiny"] : ["rmarkdown"];

    case ContentType.R_SHINY:
      return ["shiny"];

    case ContentType.R_PLUMBER: {
      const engine = await findPlumberEngine(projectDir);
      return engine ? [engine] : [];
    }

    default:
      return [];
  }
}

/**
 * Write a temporary `.posit/__publisher_deps.R` file containing
 * `library("pkg")` calls for the given dependencies.
 *
 * Returns the absolute path to the file, or null if there are
 * no extra dependencies. The caller is responsible for cleaning
 * up the file after scanning completes.
 */
export async function recordExtraDependencies(
  projectDir: string,
  deps: string[],
): Promise<string | null> {
  if (deps.length === 0) {
    return null;
  }

  const depsDir = path.join(projectDir, ".posit");
  await mkdir(depsDir, { recursive: true });

  const depsPath = path.join(depsDir, "__publisher_deps.R");
  const content = deps.map((dep) => `library("${dep}")\n`).join("");
  await writeFile(depsPath, content, "utf-8");
  return depsPath;
}

/** Remove the temporary deps file if it exists. */
export async function cleanupExtraDependencies(
  filePath: string,
): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Read the plumber engine from `_server.yml` or `_server.yaml`.
 * Returns the engine string (e.g. "plumber" or "plumber2"), or null
 * if no server file exists or can't be parsed.
 */
async function findPlumberEngine(projectDir: string): Promise<string | null> {
  for (const filename of PLUMBER_SERVER_FILES) {
    const filePath = path.join(projectDir, filename);
    if (!(await fileExistsAt(filePath))) {
      continue;
    }
    try {
      const content = await readFile(filePath, "utf-8");
      const match = /^engine:\s*(.+)/m.exec(content);
      if (match?.[1]) {
        return stripYAMLValue(match[1]);
      }
    } catch {
      // Can't read or parse — skip this file
      continue;
    }
  }
  return null;
}

/** Strip surrounding quotes and trailing inline comments from a YAML scalar value. */
function stripYAMLValue(raw: string): string {
  let s = raw.trim();
  // Remove trailing inline comment (unquoted # preceded by whitespace)
  s = s.replace(/\s+#.*$/, "");
  // Remove surrounding quotes
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s;
}
