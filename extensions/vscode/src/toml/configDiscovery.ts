// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";

import { Configuration, ConfigurationError } from "../api/types/configurations";
import { loadConfigFromFile } from "./configLoader";
import { ConfigurationLoadError } from "./configErrors";

/** Standard path: <projectDir>/.posit/publish */
export function getConfigDir(projectDir: string): string {
  return path.join(projectDir, ".posit", "publish");
}

/** Full path to a named config file: <projectDir>/.posit/publish/<name>.toml */
export function getConfigPath(projectDir: string, configName: string): string {
  return path.join(getConfigDir(projectDir), `${configName}.toml`);
}

/**
 * List TOML config file paths in a project's .posit/publish/ directory.
 * Returns an empty array if the directory doesn't exist.
 */
export async function listConfigFiles(projectDir: string): Promise<string[]> {
  const configDir = getConfigDir(projectDir);
  let entries: string[];
  try {
    entries = await fs.readdir(configDir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith(".toml"))
    .sort()
    .map((f) => path.join(configDir, f));
}

/**
 * Load a single configuration by name from a project directory.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 *
 * Throws ConfigurationLoadError for invalid configs, or raw errors for I/O failures.
 */
export function loadConfiguration(
  configName: string,
  projectDir: string,
  rootDir: string,
): Promise<Configuration> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  return loadConfigFromFile(configPath, relativeProjectDir(absDir, rootDir));
}

/**
 * Load all configurations from a project's .posit/publish/ directory.
 * Returns a mix of Configuration (valid) and ConfigurationError (invalid) objects.
 * I/O errors other than invalid configs are propagated.
 *
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export async function loadAllConfigurations(
  projectDir: string,
  rootDir: string,
): Promise<(Configuration | ConfigurationError)[]> {
  const absDir = path.resolve(rootDir, projectDir);
  const relDir = relativeProjectDir(absDir, rootDir);
  const configPaths = await listConfigFiles(absDir);
  return loadConfigsFromPaths(configPaths, relDir);
}

/**
 * Walk a directory tree and load all configurations from every .posit/publish/
 * directory found. Returns a flat array of Configuration and ConfigurationError objects.
 *
 * @param rootDir - Absolute workspace root directory. All Configuration.projectDir
 *                  values will be relative to this root.
 *
 * Skips:
 * - Dot-directories (except .posit itself)
 * - node_modules, __pycache__, renv, packrat
 * - The walk does not descend into .posit directories (configs are loaded, not walked further)
 */
export async function loadAllConfigurationsRecursive(
  rootDir: string,
): Promise<(Configuration | ConfigurationError)[]> {
  return await walkForConfigs(rootDir, rootDir);
}

// --- Private helpers ---

/**
 * Compute a relative projectDir from an absolute path, using "." for the root.
 * Matches Go's convention where projectDir is relative to the workspace root.
 */
function relativeProjectDir(absDir: string, rootDir: string): string {
  const rel = path.relative(rootDir, absDir);
  return rel === "" ? "." : rel;
}

// Load configs from a list of file paths, returning both valid configs and
// per-file errors. Invalid TOML or schema violations produce a ConfigurationError
// instead of throwing, so that one broken config file doesn't prevent the rest
// from loading. Only unexpected errors (e.g. permission denied) propagate.
async function loadConfigsFromPaths(
  configPaths: string[],
  relDir: string,
): Promise<(Configuration | ConfigurationError)[]> {
  const settled = await Promise.allSettled(
    configPaths.map((p) => loadConfigFromFile(p, relDir)),
  );
  const results: (Configuration | ConfigurationError)[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else if (result.reason instanceof ConfigurationLoadError) {
      results.push(result.reason.configurationError);
    } else {
      throw result.reason;
    }
  }
  return results;
}

// Directories that are large, never contain configs, and slow down the walk.
const SKIP_DIRECTORIES = ["node_modules", "__pycache__", "renv", "packrat"];

async function walkForConfigs(
  dir: string,
  rootDir: string,
  depth: number = 20,
): Promise<(Configuration | ConfigurationError)[]> {
  if (depth <= 0) return [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: (Configuration | ConfigurationError)[] = [];

  // Check if this directory has a .posit directory (avoids a separate fs.stat call)
  const hasPositDir = entries.some(
    (e) => e.isDirectory() && e.name === ".posit",
  );

  if (hasPositDir) {
    const relDir = relativeProjectDir(dir, rootDir);
    const configPaths = await listConfigFiles(dir);
    const configs = await loadConfigsFromPaths(configPaths, relDir);
    results.push(...configs);
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;

    // Skip dot-directories (except we already handled .posit above)
    if (name.startsWith(".")) continue;
    // Skip common large directories that (should) never contain configs
    if (SKIP_DIRECTORIES.includes(name)) {
      continue;
    }

    const childResults = await walkForConfigs(
      path.join(dir, name),
      rootDir,
      depth - 1,
    );
    results.push(...childResults);
  }

  return results;
}
