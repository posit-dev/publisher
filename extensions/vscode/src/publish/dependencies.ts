// Copyright (C) 2026 by Posit Software, PBC.

import { DEFAULT_PYTHON_PACKAGE_FILE } from "../constants";
import { getPythonPackages } from "../interpreters/pythonPackages";

/**
 * Read Python requirements from the configured package file.
 * Returns the parsed requirement lines for the deployment record,
 * or undefined if the config has no Python section.
 * Throws if the requirements file does not exist.
 */
export async function readPythonRequirements(
  projectDir: string,
  pythonConfig: { packageFile: string } | undefined,
): Promise<string[] | undefined> {
  if (!pythonConfig) {
    return undefined;
  }
  const packageFile = pythonConfig.packageFile || DEFAULT_PYTHON_PACKAGE_FILE;
  return await getPythonPackages(projectDir, packageFile);
}
