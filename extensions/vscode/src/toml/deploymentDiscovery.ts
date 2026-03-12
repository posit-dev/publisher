// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";

import {
  AllContentRecordTypes,
  ContentRecord,
  PreContentRecord,
} from "../api/types/contentRecords";
import { ContentRecordLoadError } from "./deploymentErrors";
import { loadDeploymentFromFile } from "./deploymentLoader";

/** Standard path: <projectDir>/.posit/publish/deployments */
export function getDeploymentDir(projectDir: string): string {
  return path.join(projectDir, ".posit", "publish", "deployments");
}

/** Full path to a named deployment file: <projectDir>/.posit/publish/deployments/<name>.toml */
export function getDeploymentPath(
  projectDir: string,
  deploymentName: string,
): string {
  return path.join(getDeploymentDir(projectDir), `${deploymentName}.toml`);
}

/**
 * List TOML deployment file paths in a project's .posit/publish/deployments/ directory.
 * Returns an empty array if the directory doesn't exist.
 */
export async function listDeploymentFiles(
  projectDir: string,
): Promise<string[]> {
  const deploymentDir = getDeploymentDir(projectDir);
  let entries: string[];
  try {
    entries = await fs.readdir(deploymentDir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith(".toml"))
    .sort()
    .map((f) => path.join(deploymentDir, f));
}

/**
 * Load a single deployment by name from a project directory.
 *
 * @param deploymentName - Name of the deployment (without .toml extension)
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export function loadDeployment(
  deploymentName: string,
  projectDir: string,
  rootDir: string,
): Promise<PreContentRecord | ContentRecord> {
  const absDir = path.resolve(rootDir, projectDir);
  const deploymentPath = getDeploymentPath(absDir, deploymentName);
  return loadDeploymentFromFile(
    deploymentPath,
    relativeProjectDir(absDir, rootDir),
  );
}

/**
 * Load all deployments from a project's .posit/publish/deployments/ directory.
 * Returns a mix of valid records and ContentRecordError objects.
 * I/O errors other than invalid records are propagated.
 *
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export async function loadAllDeployments(
  projectDir: string,
  rootDir: string,
): Promise<AllContentRecordTypes[]> {
  const absDir = path.resolve(rootDir, projectDir);
  const relDir = relativeProjectDir(absDir, rootDir);
  const deploymentPaths = await listDeploymentFiles(absDir);
  return loadDeploymentsFromPaths(deploymentPaths, relDir);
}

/**
 * Walk a directory tree and load all deployments from every
 * .posit/publish/deployments/ directory found. Returns a flat array.
 *
 * @param rootDir - Absolute workspace root directory. All projectDir
 *                  values will be relative to this root.
 */
export function loadAllDeploymentsRecursive(
  rootDir: string,
): Promise<AllContentRecordTypes[]> {
  return walkForDeployments(rootDir, rootDir);
}

// --- Private helpers ---

function relativeProjectDir(absDir: string, rootDir: string): string {
  const rel = path.relative(rootDir, absDir);
  return rel === "" ? "." : rel;
}

async function loadDeploymentsFromPaths(
  deploymentPaths: string[],
  relDir: string,
): Promise<AllContentRecordTypes[]> {
  const settled = await Promise.allSettled(
    deploymentPaths.map((p) => loadDeploymentFromFile(p, relDir)),
  );
  const results: AllContentRecordTypes[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else if (result.reason instanceof ContentRecordLoadError) {
      results.push(result.reason.contentRecordError);
    } else {
      throw result.reason;
    }
  }
  return results;
}

// Directories that are large, never contain deployments, and slow down the walk.
const SKIP_DIRECTORIES = ["node_modules", "__pycache__", "renv", "packrat"];

async function walkForDeployments(
  dir: string,
  rootDir: string,
  depth: number = 20,
): Promise<AllContentRecordTypes[]> {
  if (depth <= 0) return [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: AllContentRecordTypes[] = [];

  const hasPositDir = entries.some(
    (e) => e.isDirectory() && e.name === ".posit",
  );

  if (hasPositDir) {
    const relDir = relativeProjectDir(dir, rootDir);
    const deploymentPaths = await listDeploymentFiles(dir);
    const deployments = await loadDeploymentsFromPaths(deploymentPaths, relDir);
    results.push(...deployments);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith(".")) continue;
    if (SKIP_DIRECTORIES.includes(name)) continue;

    const childResults = await walkForDeployments(
      path.join(dir, name),
      rootDir,
      depth - 1,
    );
    results.push(...childResults);
  }

  return results;
}
