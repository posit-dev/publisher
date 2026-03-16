// Copyright (C) 2026 by Posit Software, PBC.

import { access, readFile } from "node:fs/promises";

/**
 * Read a file as UTF-8 text, returning null if the file doesn't exist.
 * Other I/O errors (e.g. permission denied) are rethrown.
 */
export async function readFileText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (isErrnoException(err) && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
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
