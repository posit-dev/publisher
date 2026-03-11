// Copyright (C) 2026 by Posit Software, PBC.

import { execFile } from "child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { PythonConfig } from "src/api/types/configurations";
import { getPythonRequires } from "./pythonRequires";

const REQUIREMENTS_TXT = "requirements.txt";

const pythonVersionCache = new Map<string, string>();

export interface PythonDetectionResult {
  config: PythonConfig;
  preferredPath: string;
}

/**
 * Detect Python interpreter info for a project directory.
 * Runs the interpreter to get its version, checks for requirements.txt,
 * and reads Python version requirements from project metadata.
 */
export async function detectPythonInterpreter(
  projectDir: string,
  preferredPath?: string,
): Promise<PythonDetectionResult> {
  const empty: PythonDetectionResult = {
    config: { version: "", packageFile: "", packageManager: "" },
    preferredPath: preferredPath || "",
  };

  let version = "";
  if (preferredPath) {
    version = await getPythonVersionFromExecutable(preferredPath, projectDir);
  }

  if (!version) {
    return empty;
  }

  // Check for requirements.txt
  const hasRequirements = await fileExistsAt(
    path.join(projectDir, REQUIREMENTS_TXT),
  );
  const packageFile = hasRequirements ? REQUIREMENTS_TXT : "";

  // Read Python version requirements from project metadata
  const requiresPython = await getPythonRequires(projectDir);

  return {
    config: {
      version,
      packageFile,
      packageManager: "auto",
      requiresPython: requiresPython || undefined,
    },
    preferredPath: preferredPath || "",
  };
}

function getPythonVersionFromExecutable(
  pythonPath: string,
  cwd: string,
): Promise<string> {
  // Skip cache for pyenv shims (where the real interpreter may vary)
  if (!pythonPath.includes("shims")) {
    const cached = pythonVersionCache.get(pythonPath);
    if (cached) {
      return Promise.resolve(cached);
    }
  }

  return new Promise((resolve) => {
    const args = [
      "-E",
      "-c",
      'import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))',
    ];

    execFile(pythonPath, args, { cwd, timeout: 15000 }, (error, stdout) => {
      if (error) {
        resolve("");
        return;
      }
      const version = stdout.trim();
      if (version && !pythonPath.includes("shims")) {
        pythonVersionCache.set(pythonPath, version);
      }
      resolve(version);
    });
  });
}

async function fileExistsAt(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Exported for testing
export function clearPythonVersionCache() {
  pythonVersionCache.clear();
}
