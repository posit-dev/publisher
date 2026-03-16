// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";

import { readFileText } from "./fsUtils";

/**
 * Read a Python requirements file and return its package lines,
 * filtering out comments and blank lines.
 * Returns null if the file doesn't exist.
 */
export async function readRequirementsFile(
  filePath: string,
): Promise<string[] | null> {
  const content = await readFileText(filePath);
  if (content === null) {
    return null;
  }
  const lines = content.split("\n");
  const commentRE = /^\s*(#.*)?$/;
  return lines.filter((line) => !commentRE.test(line));
}

/**
 * Get the list of Python packages from a project's requirements file.
 * Throws if the requirements file does not exist.
 */
export async function getPythonPackages(
  projectDir: string,
  packageFile: string,
): Promise<string[]> {
  const filePath = path.join(projectDir, packageFile);
  const packages = await readRequirementsFile(filePath);
  if (packages === null) {
    throw new Error(`Requirements file not found: ${filePath}`);
  }
  return packages;
}
