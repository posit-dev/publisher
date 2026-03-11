// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { readFileText } from "./fsUtils";
import { adaptPythonRequires } from "./versionConstraints";

/**
 * Find the Python version requested by the project, checking in order:
 * 1. .python-version
 * 2. pyproject.toml
 * 3. setup.cfg
 *
 * Returns the PEP 440 version specification, or empty string if not found.
 */
export async function getPythonRequires(projectDir: string): Promise<string> {
  const fromVersionFile = await readPythonVersionFile(projectDir);
  if (fromVersionFile) {
    return fromVersionFile;
  }

  const fromPyProject = await readPyProjectToml(projectDir);
  if (fromPyProject) {
    return fromPyProject;
  }

  const fromSetupCfg = await readSetupCfg(projectDir);
  if (fromSetupCfg) {
    return fromSetupCfg;
  }

  return "";
}

/**
 * Read .python-version file. Plain text, possibly comma-separated versions.
 * Each part is adapted through adaptPythonRequires().
 */
async function readPythonVersionFile(
  projectDir: string,
): Promise<string | undefined> {
  const content = await readFileText(path.join(projectDir, ".python-version"));
  if (content === null) {
    return undefined;
  }

  const parts = content.split(",");
  const adapted: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const result = adaptPythonRequires(trimmed);
    if (result === null) {
      return "";
    }
    adapted.push(result);
  }

  return adapted.join(",") || undefined;
}

const requiresPythonRe = /^\s*requires-python\s*=\s*["']([^"']+)["']\s*$/m;

/**
 * Read pyproject.toml and extract requires-python from [project] section.
 * Uses regex extraction instead of a full TOML parser.
 */
async function readPyProjectToml(
  projectDir: string,
): Promise<string | undefined> {
  const content = await readFileText(path.join(projectDir, "pyproject.toml"));
  if (content === null) {
    return undefined;
  }

  const match = requiresPythonRe.exec(content);
  if (match && match[1]) {
    return match[1];
  }

  return undefined;
}

/**
 * Read setup.cfg and extract python_requires from [options] section.
 * Simple line-by-line INI parsing.
 */
async function readSetupCfg(projectDir: string): Promise<string | undefined> {
  const content = await readFileText(path.join(projectDir, "setup.cfg"));
  if (content === null) {
    return undefined;
  }

  const lines = content.split("\n");
  let inOptionsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Section header
    if (trimmed.startsWith("[")) {
      inOptionsSection = trimmed.toLowerCase() === "[options]";
      continue;
    }

    if (inOptionsSection) {
      // Match key = value within the [options] section
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        if (key === "python_requires") {
          return trimmed.substring(eqIdx + 1).trim();
        }
      }
    }
  }

  return undefined;
}
