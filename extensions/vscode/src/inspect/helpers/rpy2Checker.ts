// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";

const rpy2RE = /^rpy2([^a-zA-Z0-9]|$)/;

/**
 * Check if a project has rpy2 as a Python dependency.
 * Reads requirements.txt and checks for lines starting with "rpy2".
 */
export async function hasRpy2Dependency(projectDir: string): Promise<boolean> {
  const reqPath = path.join(projectDir, "requirements.txt");
  let content: string;
  try {
    content = await fs.readFile(reqPath, "utf-8");
  } catch {
    return false;
  }
  const lines = content.split("\n");
  for (const line of lines) {
    if (rpy2RE.test(line.trim())) {
      return true;
    }
  }
  return false;
}
