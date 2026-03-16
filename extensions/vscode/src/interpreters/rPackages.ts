// Copyright (C) 2026 by Posit Software, PBC.

import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { fileExistsAt } from "./fsUtils";
import type { PositronRSettings } from "../api/types/positron";

const DEFAULT_RENV_LOCKFILE = "renv.lock";
const R_SCAN_TIMEOUT = 300_000; // 5 minutes — renv operations can be slow

/**
 * Compute the CRAN repository URL from Positron R settings.
 * Mirrors the Go `RepoURLFromOptions` / `repoURLFrom` logic.
 */
export function repoURLFromOptions(settings?: PositronRSettings): string {
  if (!settings) {
    return repoURLFrom("auto", "");
  }
  const mode =
    (settings.defaultRepositories ?? "").trim().toLowerCase() || "auto";
  const ppm = (settings.packageManagerRepository ?? "").trim();
  return repoURLFrom(mode, ppm);
}

function repoURLFrom(mode: string, ppm: string): string {
  switch (mode) {
    case "auto":
      if (ppm) {
        return ppm.replace(/\/+$/, "");
      }
      return "https://cloud.r-project.org";
    case "posit-ppm":
      return "https://packagemanager.posit.co/cran/latest";
    case "rstudio":
      return "https://cran.rstudio.com";
    case "none":
      return "";
    default:
      if (mode.startsWith("http://") || mode.startsWith("https://")) {
        return mode.replace(/\/+$/, "");
      }
      return "";
  }
}

/**
 * Validate that a string is safe for injection into an R string literal.
 * Rejects characters that could break the R code: double-quote, newline, carriage-return.
 */
function validateRStringLiteral(value: string, label: string): void {
  if (/["\n\r]/.test(value)) {
    throw new Error(
      `${label} contains invalid characters: ${JSON.stringify(value)}`,
    );
  }
}

/**
 * Validate the base filename of a lockfile path.
 * The saveName may contain slashes (e.g. ".renv/profiles/staging/renv.lock"),
 * but the base filename must not contain path traversal components.
 */
function validateSaveName(saveName: string): void {
  const base = path.posix.basename(saveName);
  if (!base || base === "." || base === "..") {
    throw new Error(`Invalid lockfile name: ${JSON.stringify(saveName)}`);
  }
  // Check for directory traversal
  const normalized = path.posix.normalize(saveName);
  if (normalized.startsWith("..") || path.posix.isAbsolute(normalized)) {
    throw new Error(`Invalid lockfile path: ${JSON.stringify(saveName)}`);
  }
}

/**
 * Scan R package dependencies in a project directory using renv.
 *
 * This runs an R script that:
 * 1. Scans the project for R dependencies
 * 2. Initializes renv in the project directory
 * 3. Hydrates packages
 * 4. Creates a lockfile snapshot
 *
 * @param projectDir Absolute path to the project directory
 * @param rPath Path to the R executable
 * @param saveName Relative path for the lockfile (default: "renv.lock")
 * @param positronR Optional Positron R settings for repository configuration
 */
export async function scanRPackages(
  projectDir: string,
  rPath: string,
  saveName?: string,
  positronR?: PositronRSettings,
): Promise<void> {
  const lockfileName = saveName || DEFAULT_RENV_LOCKFILE;
  validateSaveName(lockfileName);

  const repoURL = repoURLFromOptions(positronR);

  // Normalize paths for the R script (use forward slashes)
  const normalizedProjectPath = projectDir.split(path.sep).join("/");
  const normalizedLockfile = lockfileName.split(path.sep).join("/");

  // Validate strings before injecting into R code
  validateRStringLiteral(normalizedProjectPath, "Project path");
  validateRStringLiteral(normalizedLockfile, "Lockfile name");
  validateRStringLiteral(repoURL, "Repository URL");

  const script = `(function(){
  options(renv.consent = TRUE)
  repoUrl <- "${repoURL}"
  if (nzchar(repoUrl)) options(repos = c(CRAN = repoUrl))
  rPathsVec <- c("${normalizedProjectPath}")
  deps <- character()
  for (path in rPathsVec) {
    tryCatch({
      d <- renv::dependencies(path = path, progress = FALSE)
      deps <- c(deps, d$Package[!is.na(d$Package)])
    }, error = function(e) {
      # Silently skip paths that cause errors (e.g., non-existent files, directories)
      invisible()
    })
  }
  deps <- setdiff(deps, c("renv"))
  targetPath <- "${normalizedProjectPath}"
  # initialize project with bare = TRUE to avoid polluting user's project
  # then hydrate() manually to copy installed packages over
  renv::init(project = targetPath, bare = TRUE, force = TRUE)
  renv::hydrate(packages = deps, project = targetPath, prompt = FALSE)
  lockfile <- file.path(targetPath, "${normalizedLockfile}")
  renv::snapshot(project = targetPath, lockfile = lockfile, prompt = FALSE, type = "all")
  invisible()
})()`;

  // Write script to a temp file
  const tmpFile = path.join(
    os.tmpdir(),
    `publisher-renv-${Date.now()}-${Math.random().toString(36).slice(2)}.R`,
  );
  await writeFile(tmpFile, script, "utf-8");

  try {
    await runRScript(rPath, tmpFile, projectDir);
  } finally {
    // Clean up temp file
    try {
      await unlink(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Verify the lockfile was created
  const lockfilePath = path.join(projectDir, lockfileName);
  const exists = await fileExistsAt(lockfilePath);
  if (!exists) {
    throw new Error(`renv could not create lockfile: ${lockfilePath}`);
  }
}

function runRScript(
  rPath: string,
  scriptFile: string,
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      rPath,
      ["-s", "-f", scriptFile],
      { cwd, timeout: R_SCAN_TIMEOUT },
      (error, _stdout, stderr) => {
        if (error) {
          const msg = stderr
            ? `R scan failed: ${stderr}`
            : `R scan failed: ${error.message}`;
          reject(new Error(msg));
          return;
        }
        resolve();
      },
    );
  });
}
