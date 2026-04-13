// Copyright (C) 2026 by Posit Software, PBC.

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ManifestPackage } from "../bundler/types";
import type { RConfig } from "../api/types/configurations";
import { parseDcf, type DcfRecord } from "./dcfParser";
import type { RenvLockfile, RenvPackage } from "./rPackageDescriptions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvailablePackage = {
  name: string;
  version: string;
  repository: string;
};

type Repository = { Name: string; URL: string };

// ---------------------------------------------------------------------------
// R subprocess helpers
// ---------------------------------------------------------------------------

const R_SUBPROCESS_TIMEOUT = 300_000; // 5 minutes

/**
 * Escape a string for safe interpolation inside an R double-quoted string literal.
 * Prevents code injection via crafted directory paths or repository names/URLs.
 */
export function escapeForRString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Run an R expression and return stdout.
 * Mirrors the runRScript pattern from rPackages.ts.
 */
function runRExpression(
  rPath: string,
  expression: string,
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      rPath,
      ["-s", "-e", expression],
      {
        cwd,
        timeout: R_SUBPROCESS_TIMEOUT,
        env: { ...process.env, RENV_CONFIG_AUTOLOADER_ENABLED: "FALSE" },
      },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr
            ? `R subprocess failed: ${stderr}`
            : `R subprocess failed: ${error.message}`;
          reject(new Error(msg));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/** Parse the output of `cat(.libPaths(), sep="\n")`. */
export function parseLibPathsOutput(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("-"));
}

/**
 * Get the library paths where R packages are installed.
 * Mirrors Go's GetLibPaths().
 */
export async function getLibPaths(
  rPath: string,
  projectDir: string,
): Promise<string[]> {
  const output = await runRExpression(
    rPath,
    'cat(.libPaths(), sep="\\n")',
    projectDir,
  );
  return parseLibPathsOutput(output);
}

/**
 * Build the R code for listing available packages from given repositories.
 * Mirrors Go's ListAvailablePackages().
 */
export function buildAvailablePackagesCode(repos: Repository[]): string {
  const urls = repos
    .map((r) => `"${escapeForRString(r.URL.replace(/\/+$/, ""))}"`)
    .join(", ");
  const names = repos
    .map((r, i) => `"${escapeForRString(r.Name || `repo_${i}`)}"`)
    .join(", ");

  // R script: query CRAN-style repos for available source packages,
  // then print each as "name version repoURL" on one line.
  return [
    `pkgs <- available.packages(`,
    `  repos = setNames(c(${urls}), c(${names})),`,
    `  type = "source",`,
    `  filters = c(getOption("rsconnect.available_packages_filters", default = c()), "duplicates")`,
    `)`,
    `info <- pkgs[, c("Package", "Version", "Repository")]`,
    `apply(info, 1, function(x) cat(x, sep = " ", collapse = "\\n"))`,
    `invisible()`,
  ].join("; ");
}

/** Parse the output of `available.packages()` — each line is "name version repoURL". */
export function parseAvailablePackagesOutput(
  output: string,
): AvailablePackage[] {
  const available: AvailablePackage[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    const parts = trimmed.split(" ");
    if (parts.length !== 3) {
      continue;
    }
    available.push({
      name: parts[0]!,
      version: parts[1]!,
      repository: parts[2]!.replace(/\/src\/contrib$/, ""),
    });
  }
  return available;
}

/**
 * List packages available in the given repositories.
 * Mirrors Go's ListAvailablePackages().
 */
export async function listAvailablePackages(
  rPath: string,
  projectDir: string,
  repos: Repository[],
): Promise<AvailablePackage[]> {
  const code = buildAvailablePackagesCode(repos);
  const output = await runRExpression(rPath, code, projectDir);
  return parseAvailablePackagesOutput(output);
}

/**
 * Discover Bioconductor repository URLs via R.
 * Mirrors Go's GetBioconductorRepos().
 */
export async function getBioconductorRepos(
  rPath: string,
  projectDir: string,
): Promise<Repository[]> {
  const escapedDir = escapeForRString(projectDir);

  // R script: discover Bioconductor repo URLs via BiocManager or renv,
  // then print each as "name url" on one line.
  const code = [
    `if (requireNamespace("BiocManager", quietly = TRUE)`,
    `    || requireNamespace("BiocInstaller", quietly = TRUE)) {`,
    `  repos <- getFromNamespace("renv_bioconductor_repos", "renv")("${escapedDir}")`,
    `  ; repos <- repos[setdiff(names(repos), "CRAN")]`,
    `  ; cat(repos, labels = names(repos), fill = 1)`,
    `  ; invisible()`,
    `}`,
  ].join("\n");

  const output = await runRExpression(rPath, code, projectDir);
  return parseBioconductorReposOutput(output);
}

/** Parse the output of the Bioconductor repos discovery script — each line is "name url". */
export function parseBioconductorReposOutput(output: string): Repository[] {
  const repos: Repository[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("-")) {
      continue;
    }
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) {
      continue;
    }
    repos.push({
      Name: trimmed.slice(0, spaceIdx),
      URL: trimmed.slice(spaceIdx + 1),
    });
  }
  return repos;
}

// ---------------------------------------------------------------------------
// Package resolution helpers (ported from Go's manifest_packages.go)
// ---------------------------------------------------------------------------

/** Fields whose continuation lines preserve original indentation. */
const KEEP_WHITE_FIELDS = [
  "Description",
  "Authors@R",
  "Author",
  "Built",
  "Packaged",
];

/**
 * Whether a repository name is CRAN or a Posit Package Manager variant.
 * These are all CRAN mirrors and should be treated equivalently.
 */
export function isCRANLike(repo: string): boolean {
  return repo === "CRAN" || repo === "RSPM" || repo === "PPM" || repo === "P3M";
}

/**
 * Parse an R version string into an array of integers for comparison.
 * R versions are sequences of non-negative integers separated by . or -.
 */
function packageVersion(vs: string): number[] {
  return vs
    .split(/[^0-9]+/)
    .filter((s) => s !== "")
    .map(Number);
}

/**
 * Whether a package is a dev version (newer than what's available in repos).
 */
function isDevVersion(
  pkg: RenvPackage,
  availablePackages: AvailablePackage[],
): boolean {
  const repoVersion = findAvailableVersion(pkg.Package, availablePackages);
  if (!repoVersion) {
    return false;
  }
  const installed = packageVersion(pkg.Version);
  const available = packageVersion(repoVersion);
  // Compare arrays lexicographically
  const len = Math.max(installed.length, available.length);
  for (let i = 0; i < len; i++) {
    const a = installed[i] ?? 0;
    const b = available[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

function findAvailableVersion(
  pkgName: string,
  availablePackages: AvailablePackage[],
): string {
  for (const avail of availablePackages) {
    if (avail.name === pkgName) {
      return avail.version;
    }
  }
  return "";
}

function findRepoUrl(
  pkgName: string,
  availablePackages: AvailablePackage[],
): string {
  for (const avail of availablePackages) {
    if (avail.name === pkgName) {
      return avail.repository;
    }
  }
  return "";
}

function findRepoNameByURL(repoUrl: string, repos: Repository[]): string {
  for (const repo of repos) {
    if (repo.URL === repoUrl) {
      return repo.Name;
    }
  }
  return "";
}

function remotePkgRefOrDerived(pkg: RenvPackage): string {
  return (
    pkg.RemotePkgRef ||
    (pkg.RemoteUsername && pkg.RemoteRepo
      ? `${pkg.RemoteUsername}/${pkg.RemoteRepo}`
      : "")
  );
}

function remoteRepoURL(remoteType: string, pkgRef: string): string {
  if (!pkgRef) return "";
  switch (remoteType) {
    case "github":
      return `https://github.com/${pkgRef}`;
    case "gitlab":
      return `https://gitlab.com/${pkgRef}`;
    case "bitbucket":
      return `https://bitbucket.org/${pkgRef}`;
    default:
      return "";
  }
}

/**
 * Determine the Source and Repository for a manifest package entry.
 * Mirrors Go's toManifestPackage().
 */
export function toManifestPackage(
  pkg: RenvPackage,
  repos: Repository[],
  availablePackages: AvailablePackage[],
  biocPackages: AvailablePackage[],
): { Source: string; Repository: string } {
  let source = pkg.Source;
  const repository = pkg.Repository ?? "";

  if (!repository && pkg.RemoteRepos?.includes("bioconductor.org")) {
    // Workaround for https://github.com/rstudio/renv/issues/1202
    source = "Bioconductor";
  }

  switch (source) {
    case "Repository": {
      if (isCRANLike(repository)) {
        if (isDevVersion(pkg, availablePackages)) {
          return { Source: "", Repository: "" };
        }
        return {
          Source: repository,
          Repository: findRepoUrl(pkg.Package, availablePackages),
        };
      }
      // Non-CRAN repository — look up from available packages
      const repoUrl = findRepoUrl(pkg.Package, availablePackages);
      return {
        Source: findRepoNameByURL(repoUrl, repos),
        Repository: repoUrl,
      };
    }

    case "Bioconductor": {
      let repoUrl = findRepoUrl(pkg.Package, availablePackages);
      if (!repoUrl) {
        repoUrl = findRepoUrl(pkg.Package, biocPackages);
      }
      return { Source: "Bioconductor", Repository: repoUrl };
    }

    case "Bitbucket":
    case "GitHub":
    case "GitLab": {
      const lowerSource = source.toLowerCase();
      const ref = remotePkgRefOrDerived(pkg);
      const url = ref
        ? remoteRepoURL(lowerSource, ref) || pkg.RemoteUrl || ""
        : "";
      return { Source: lowerSource, Repository: url };
    }

    case "Local":
    case "unknown":
      return { Source: "", Repository: "" };

    default:
      return { Source: pkg.Source, Repository: repository };
  }
}

/**
 * Read a package's DESCRIPTION file from the first matching library path.
 * Mirrors Go's readPackageDescription().
 */
export async function readPackageDescription(
  pkgName: string,
  libPaths: string[],
): Promise<DcfRecord> {
  for (const libPath of libPaths) {
    const descPath = path.join(libPath, pkgName, "DESCRIPTION");
    try {
      const text = await readFile(descPath, "utf-8");
      const records = parseDcf(text, KEEP_WHITE_FIELDS);
      if (records.length === 0) {
        throw new Error(`${descPath}: invalid DESCRIPTION file`);
      }
      return records[0]!;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        // Try next libPath
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `${pkgName}: package not found in current libPaths; consider running renv::restore() to populate the renv library`,
  );
}

// ---------------------------------------------------------------------------
// Main library mapper
// ---------------------------------------------------------------------------

/** Interface for R subprocess operations, injectable for testing. */
export type PackageLister = {
  getLibPaths(rPath: string, projectDir: string): Promise<string[]>;
  listAvailablePackages(
    rPath: string,
    projectDir: string,
    repos: Repository[],
  ): Promise<AvailablePackage[]>;
  getBioconductorRepos(
    rPath: string,
    projectDir: string,
  ): Promise<Repository[]>;
};

const defaultLister: PackageLister = {
  getLibPaths,
  listAvailablePackages,
  getBioconductorRepos,
};

/**
 * Read an renv.lock and build manifest packages using the local R library.
 *
 * This is the library-based package mapper (used when `packages_from_library = true`).
 * Unlike the lockfile-only mapper, it reads each package's DESCRIPTION file
 * from the local R library and queries R for available packages to produce
 * richer manifest entries.
 *
 * Mirrors Go's defaultPackageMapper.GetManifestPackages().
 */
export async function libraryToManifestPackages(
  projectDir: string,
  rConfig: RConfig,
  rPath: string,
  lister: PackageLister = defaultLister,
): Promise<Record<string, ManifestPackage>> {
  const packageFile = rConfig.packageFile || "renv.lock";
  const lockfilePath = path.join(projectDir, packageFile);

  const content = await readFile(lockfilePath, "utf-8");
  const lockfile: RenvLockfile = JSON.parse(content);

  if (!lockfile.R?.Repositories?.length) {
    throw new Error(
      "renv.lock is not compatible: missing Repositories section. " +
        "Regenerate the lockfile with renv >= 1.1.0",
    );
  }

  // Get library paths and available packages
  const libPaths = await lister.getLibPaths(rPath, projectDir);
  const repos = lockfile.R.Repositories;
  const availablePackages = await lister.listAvailablePackages(
    rPath,
    projectDir,
    repos,
  );

  // Discover Bioconductor repos and their packages
  const biocRepos = await lister.getBioconductorRepos(rPath, projectDir);
  let biocPackages: AvailablePackage[] = [];
  if (biocRepos.length > 0) {
    biocPackages = await lister.listAvailablePackages(
      rPath,
      projectDir,
      biocRepos,
    );
  }

  // Process each package, sorted by name for deterministic output
  const manifestPackages: Record<string, ManifestPackage> = {};
  const pkgNames = Object.keys(lockfile.Packages).sort();

  for (const pkgName of pkgNames) {
    const pkg = lockfile.Packages[pkgName]!;

    const { Source, Repository } = toManifestPackage(
      pkg,
      repos,
      availablePackages,
      biocPackages,
    );

    const description = await readPackageDescription(pkgName, libPaths);

    // Validate version consistency between lockfile and library
    if (description["Version"] !== pkg.Version) {
      throw new Error(
        `package ${pkgName}: versions in lockfile '${pkg.Version}' and library '${description["Version"]}' are out of sync. Use renv::restore() or renv::snapshot() to synchronize`,
      );
    }

    // Validate that Source is non-empty
    if (!Source) {
      throw new Error(
        `cannot re-install packages installed from source; all packages must be installed from a reproducible location such as a repository. Package ${pkgName}, Version ${pkg.Version}`,
      );
    }

    manifestPackages[pkgName] = {
      Source,
      Repository,
      description,
    };
  }

  return manifestPackages;
}
