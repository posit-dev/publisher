// Copyright (C) 2026 by Posit Software, PBC.

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ManifestPackage } from "../bundler/types";
import { DEFAULT_PYTHON_PACKAGE_FILE } from "../constants";
import { getPythonPackages } from "../interpreters/pythonPackages";
import {
  lockfileToManifestPackages,
  type RenvLockfile,
} from "./rPackageDescriptions";

const DEFAULT_R_PACKAGE_FILE = "renv.lock";

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

export type ResolvedRPackages = {
  packages: Record<string, ManifestPackage>;
  lockfilePath: string;
  lockfile: RenvLockfile;
};

/**
 * Read an renv.lock file, validate it, and convert to manifest packages.
 *
 * This is the main entry point for R package resolution during publish.
 * It reads the lockfile from disk, enforces the modern format requirement
 * (renv >= 1.1.0 with Repositories), and converts each package entry
 * into the manifest format needed by the deployment bundle.
 */
export async function resolveRPackages(
  projectDir: string,
  rConfig: { packageFile: string } | undefined,
): Promise<ResolvedRPackages | undefined> {
  if (!rConfig) {
    return undefined;
  }

  const packageFile = rConfig.packageFile || DEFAULT_R_PACKAGE_FILE;
  const lockfilePath = path.join(projectDir, packageFile);

  const content = await readFile(lockfilePath, "utf-8");
  const lockfile: RenvLockfile = JSON.parse(content);

  if (!lockfile.R?.Repositories?.length) {
    throw new Error(
      "renv.lock is not compatible: missing Repositories section. " +
        "Regenerate the lockfile with renv >= 1.1.0",
    );
  }

  const packages = lockfileToManifestPackages(lockfile);
  return { packages, lockfilePath, lockfile };
}
