// Copyright (C) 2025 by Posit Software, PBC.

import { execFile } from "child_process";
import { Uri } from "vscode";
import { RConfig } from "src/api/types/configurations";
import { fileExists } from "src/utils/files";

const DEFAULT_RENV_LOCKFILE = "renv.lock";
const R_VERSION_TIMEOUT = 15000;
const RENV_LOCKFILE_TIMEOUT = 15000;

const rVersionRe = /^R version (\d+\.\d+\.\d+)/;
const renvLockPathRe = /^\[1\] "(.*)"/;

export interface RDetectionResult {
  config: RConfig;
  preferredPath: string;
}

/**
 * Detect R interpreter info for a project directory.
 * Runs `R --version` to get the version, resolves the renv lockfile path,
 * and checks for lockfile existence.
 */
export async function detectRInterpreter(
  projectDir: string,
  preferredPath?: string,
): Promise<RDetectionResult> {
  const empty: RDetectionResult = {
    config: { version: "", packageFile: "", packageManager: "" },
    preferredPath: preferredPath || "",
  };

  let version = "";
  if (preferredPath) {
    version = await getRVersionFromExecutable(preferredPath);
  }

  if (!version) {
    return empty;
  }

  // Resolve the renv lockfile path
  const lockfilePath = await resolveRenvLockfile(preferredPath!, projectDir);
  const lockfileUri = Uri.joinPath(Uri.file(projectDir), lockfilePath);
  const lockfilePresent = await fileExists(lockfileUri);
  const packageFile = lockfilePresent ? lockfilePath : "";

  return {
    config: {
      version,
      packageFile,
      packageManager: "renv",
    },
    preferredPath: preferredPath || "",
  };
}

/**
 * Get R version by running `R --version` and parsing the output.
 * R may output the version on stdout or stderr, so we check both.
 */
function getRVersionFromExecutable(rPath: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      rPath,
      ["--version"],
      { timeout: R_VERSION_TIMEOUT },
      (_error, stdout, stderr) => {
        // R --version may return non-zero on some platforms, but still
        // outputs the version. Check output even on error.
        const combined = (stdout || "") + (stderr || "");
        const lines = combined.split("\n");
        for (const line of lines) {
          const match = rVersionRe.exec(line);
          if (match && match[1]) {
            resolve(match[1]);
            return;
          }
        }
        resolve("");
      },
    );
  });
}

/**
 * Resolve the renv lockfile path by trying renv::paths$lockfile() first,
 * falling back to the default "renv.lock".
 */
async function resolveRenvLockfile(
  rPath: string,
  projectDir: string,
): Promise<string> {
  const lockfilePath = await getRenvLockfileFromR(rPath, projectDir);
  if (lockfilePath) {
    // The renv lockfile path is absolute; make it relative to projectDir
    if (lockfilePath.startsWith(projectDir)) {
      const relative = lockfilePath.substring(projectDir.length);
      // Remove leading path separator
      return relative.replace(/^[/\\]/, "");
    }
    return lockfilePath;
  }
  return DEFAULT_RENV_LOCKFILE;
}

/**
 * Get the renv lockfile path from R by running renv::paths$lockfile().
 * Returns the absolute path or empty string on failure.
 */
function getRenvLockfileFromR(
  rPath: string,
  cwd: string,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      rPath,
      ["-s", "-e", "renv::paths$lockfile()"],
      { cwd, timeout: RENV_LOCKFILE_TIMEOUT },
      (error, stdout, stderr) => {
        if (error) {
          resolve(undefined);
          return;
        }
        const combined = (stdout || "") + (stderr || "");
        const lines = combined.split("\n");
        for (const line of lines) {
          const match = renvLockPathRe.exec(line);
          if (match && match[1]) {
            resolve(match[1]);
            return;
          }
        }
        resolve(undefined);
      },
    );
  });
}
