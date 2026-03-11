// Copyright (C) 2026 by Posit Software, PBC.

import { access, readFile } from "node:fs/promises";

/**
 * Read a file as UTF-8 text, returning null if the file doesn't exist
 * or can't be read.
 */
export async function readFileText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Check whether a file exists at the given path.
 */
export async function fileExistsAt(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
