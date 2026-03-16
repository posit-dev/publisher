// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";

import {
  GetRPackagesResponse,
  RPackage,
  RRepositoryConfig,
  RVersionConfig,
} from "src/api/types/packages";

import { readFileText } from "./fsUtils";

// Raw types matching the PascalCase keys in renv.lock JSON files.
interface RenvLockfile {
  R: {
    Version: string;
    Repositories: Array<{ Name: string; URL: string }>;
  };
  Packages: Record<
    string,
    {
      Package: string;
      Version: string;
      Source: string;
      Repository: string;
    }
  >;
}

/**
 * Read an renv.lock file and return the parsed lockfile response,
 * transforming PascalCase keys to the lowercase format used by the API types.
 * Returns null if the file doesn't exist or can't be read.
 * Throws if the file exists but contains invalid JSON.
 */
export async function readLockfile(
  filePath: string,
): Promise<GetRPackagesResponse | null> {
  const content = await readFileText(filePath);
  if (content === null) {
    return null;
  }

  const raw: RenvLockfile = JSON.parse(content);

  const repositories: RRepositoryConfig[] = (raw.R?.Repositories ?? []).map(
    (repo) => ({
      name: repo.Name,
      url: repo.URL,
    }),
  );

  const r: RVersionConfig = {
    version: raw.R?.Version ?? "",
    repositories,
  };

  const packages: Record<string, RPackage> = {};
  for (const [key, pkg] of Object.entries(raw.Packages ?? {})) {
    packages[key] = {
      package: pkg.Package,
      version: pkg.Version,
      source: pkg.Source,
      repository: pkg.Repository,
    };
  }

  return { r, packages };
}

/**
 * Get the R packages from a project's renv.lock file.
 * Throws if the lockfile does not exist or contains invalid JSON.
 */
export async function getRPackages(
  projectDir: string,
  packageFile: string,
): Promise<GetRPackagesResponse> {
  const filePath = path.join(projectDir, packageFile);
  const result = await readLockfile(filePath);
  if (result === null) {
    throw new Error(`Lockfile not found: ${filePath}`);
  }
  return result;
}
