// Copyright (C) 2026 by Posit Software, PBC.
//
// Shared utilities for integration tests that exercise real subprocesses
// and filesystem operations.
//
// These helpers are used by:
//   - src/inspect/integration.test.ts
//   - src/publish/integration.test.ts

import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Create a temp directory, pass it to `fn`, then clean up. */
export async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Check if an executable is available on PATH by attempting to run it.
 * Used to determine whether interpreter-dependent tests should be skipped.
 */
export async function isExecutableAvailable(name: string): Promise<boolean> {
  try {
    await execFileAsync(name, ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the renv R package is installed by attempting to load it.
 * Used to determine whether renv-dependent tests should be skipped.
 */
export async function isRenvAvailable(): Promise<boolean> {
  try {
    await execFileAsync("Rscript", ["-e", "library(renv)"]);
    return true;
  } catch {
    return false;
  }
}
