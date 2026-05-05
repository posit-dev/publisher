// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import picomatch from "picomatch";

/**
 * Glob a directory for files matching a pattern.
 * Returns sorted absolute paths of matching files (not directories).
 */
export async function globDir(
  dir: string,
  pattern: string,
  options?: { nocase?: boolean },
): Promise<string[]> {
  const isMatch = picomatch(pattern, { nocase: options?.nocase });
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const matched: string[] = [];
  for (const entry of entries) {
    if (isMatch(entry)) {
      const fullPath = path.join(dir, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) {
          // Normalize to forward slashes for cross-platform consistency
          matched.push(fullPath.replace(/\\/g, "/"));
        }
      } catch {
        // File may have been deleted between readdir and stat
      }
    }
  }
  matched.sort();
  return matched;
}
