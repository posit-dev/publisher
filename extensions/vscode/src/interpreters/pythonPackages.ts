// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";

import { DEFAULT_PYTHON_PACKAGE_FILE } from "../constants";
import { fileExistsAt, readFileText } from "../utils/fsUtils";
import { generateRequirements } from "./pythonDependencySources";
import {
  scanPythonDependencies,
  type ScanPythonDependenciesResult,
} from "./scanPythonDependencies";

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
 *
 * If the default requirements file (requirements.txt) does not exist,
 * falls back to generating requirements from pylock.toml, uv.lock, or
 * pyproject.toml. Non-default package files are never auto-generated —
 * if they're missing, this throws immediately.
 * Throws if no dependency source is available.
 */
export async function getPythonPackages(
  projectDir: string,
  packageFile: string,
): Promise<string[]> {
  const filePath = path.join(projectDir, packageFile);
  const packages = await readRequirementsFile(filePath);
  if (packages !== null) {
    return packages;
  }

  // Only fall back to lockfile generation for the default package file.
  // If the user explicitly configured a different file, they expect that
  // specific file — don't silently substitute generated dependencies.
  if (packageFile === DEFAULT_PYTHON_PACKAGE_FILE) {
    const generated = await generateRequirements(projectDir);
    if (generated !== null) {
      return generated;
    }
  }

  throw new Error(`Requirements file not found: ${filePath}`);
}

/**
 * Make sure a Python project has a requirements file to deploy with.
 *
 * If the configured package file is missing and no other dependency source
 * (pylock.toml, uv.lock, pyproject.toml) can stand in for the default
 * requirements.txt, scan the project's imports and write the package file.
 *
 * Returns the scan result if a file was written, or undefined if an existing
 * dependency source was found.
 */
export async function ensurePythonPackageFile(
  projectDir: string,
  packageFile: string,
  pythonPath: string,
): Promise<ScanPythonDependenciesResult | undefined> {
  if (await fileExistsAt(path.join(projectDir, packageFile))) {
    return undefined;
  }
  if (
    packageFile === DEFAULT_PYTHON_PACKAGE_FILE &&
    (await generateRequirements(projectDir)) !== null
  ) {
    return undefined;
  }
  return await scanPythonDependencies(projectDir, pythonPath, packageFile);
}
