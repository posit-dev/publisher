// Copyright (C) 2026 by Posit Software, PBC.

import { access, readFile } from "node:fs/promises";

/**
 * Read a file as UTF-8 text, returning null if the file doesn't exist.
 * Propagates non-ENOENT errors (e.g. permission errors).
 */
export async function readFileText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
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
