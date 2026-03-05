// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";

import { Configuration, ConfigurationError } from "../api/types/configurations";
import { loadConfigFromFile } from "./loader";
import { ConfigurationLoadError } from "./errors";

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
 * Throws ConfigurationLoadError for invalid configs, or raw errors for I/O failures.
 */
export function loadConfiguration(
  configName: string,
  projectDir: string,
): Promise<Configuration> {
  const configPath = getConfigPath(projectDir, configName);
  return loadConfigFromFile(configPath, projectDir);
}

/**
 * Load all configurations from a project's .posit/publish/ directory.
 * Returns a mix of Configuration (valid) and ConfigurationError (invalid) objects.
 * I/O errors other than invalid configs are propagated.
 */
export async function loadAllConfigurations(
  projectDir: string,
): Promise<(Configuration | ConfigurationError)[]> {
  const configPaths = await listConfigFiles(projectDir);
  const results: (Configuration | ConfigurationError)[] = [];

  for (const configPath of configPaths) {
    try {
      results.push(await loadConfigFromFile(configPath, projectDir));
    } catch (error) {
      if (error instanceof ConfigurationLoadError) {
        results.push(error.configurationError);
      } else {
        throw error;
      }
    }
  }

  return results;
}

/**
 * Walk a directory tree and load all configurations from every .posit/publish/
 * directory found. Returns a flat array of Configuration and ConfigurationError objects.
 *
 * Skips:
 * - Dot-directories (except .posit itself)
 * - node_modules
 * - The walk does not descend into .posit directories (configs are loaded, not walked further)
 */
export async function loadAllConfigurationsRecursive(
  rootDir: string,
): Promise<(Configuration | ConfigurationError)[]> {
  const results: (Configuration | ConfigurationError)[] = [];
  await walkForConfigs(rootDir, results);
  return results;
}

async function walkForConfigs(
  dir: string,
  results: (Configuration | ConfigurationError)[],
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Check if this directory has a .posit/publish/ with configs
  const positDir = path.join(dir, ".posit");
  const publishDir = path.join(positDir, "publish");
  let hasPublishDir = false;
  try {
    const stat = await fs.stat(publishDir);
    hasPublishDir = stat.isDirectory();
  } catch {
    // doesn't exist
  }

  if (hasPublishDir) {
    const configs = await loadAllConfigurations(dir);
    results.push(...configs);
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;

    // Skip dot-directories (except we already handled .posit above)
    if (name.startsWith(".")) continue;
    // Skip node_modules
    if (name === "node_modules") continue;

    await walkForConfigs(path.join(dir, name), results);
  }
}
