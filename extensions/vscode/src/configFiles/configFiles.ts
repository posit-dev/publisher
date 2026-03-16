// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";

import { FileAction } from "../api/types/files";
import { getConfigPath } from "../toml/configDiscovery";
import { loadConfigFromFile } from "../toml/configLoader";
import { writeConfigToFile } from "../toml/configWriter";
import { relativeProjectDir } from "../toml/tomlHelpers";

/**
 * Include a file path in a configuration's files list.
 *
 * - If an exclusion (`!path`) exists, removes it (effectively re-including the file).
 * - Otherwise, adds `path` to the list (idempotent — skips if already present).
 *
 * Matches Go's `applyFileAction` with `fileActionInclude`.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param filePath - The file path to include (e.g., "/app.py")
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export async function includeFile(
  configName: string,
  filePath: string,
  projectDir: string,
  rootDir: string,
): Promise<void> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  const relDir = relativeProjectDir(absDir, rootDir);
  const cfg = await loadConfigFromFile(configPath, relDir);

  const files = cfg.configuration.files ?? [];
  const exclusionPattern = "!" + filePath;
  const exclusionIndex = files.indexOf(exclusionPattern);

  if (exclusionIndex !== -1) {
    // Remove the exclusion to re-include the file
    cfg.configuration.files = [
      ...files.slice(0, exclusionIndex),
      ...files.slice(exclusionIndex + 1),
    ];
  } else if (!files.includes(filePath)) {
    // Add the path (idempotent)
    cfg.configuration.files = [...files, filePath];
  } else {
    // Already included — no-op
    return;
  }

  await writeConfigToFile(configName, projectDir, rootDir, cfg.configuration);
}

/**
 * Exclude a file path from a configuration's files list.
 *
 * - If an explicit inclusion (`path`) exists, removes it (effectively excluding the file).
 * - Otherwise, adds `!path` exclusion pattern (idempotent — skips if already present).
 *
 * Matches Go's `applyFileAction` with `fileActionExclude`.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param filePath - The file path to exclude (e.g., "/data.csv")
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export async function excludeFile(
  configName: string,
  filePath: string,
  projectDir: string,
  rootDir: string,
): Promise<void> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  const relDir = relativeProjectDir(absDir, rootDir);
  const cfg = await loadConfigFromFile(configPath, relDir);

  const files = cfg.configuration.files ?? [];
  const inclusionIndex = files.indexOf(filePath);

  if (inclusionIndex !== -1) {
    // Remove the explicit inclusion to exclude the file
    cfg.configuration.files = [
      ...files.slice(0, inclusionIndex),
      ...files.slice(inclusionIndex + 1),
    ];
  } else {
    const exclusionPattern = "!" + filePath;
    if (!files.includes(exclusionPattern)) {
      // Add the exclusion pattern (idempotent)
      cfg.configuration.files = [...files, exclusionPattern];
    } else {
      // Already excluded — no-op
      return;
    }
  }

  await writeConfigToFile(configName, projectDir, rootDir, cfg.configuration);
}

/**
 * Update a configuration's files list by including or excluding a file path.
 *
 * Convenience wrapper that dispatches to `includeFile` or `excludeFile`
 * based on the action. Used by callers that pass the action dynamically.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param filePath - The file path to include or exclude
 * @param action - FileAction.INCLUDE or FileAction.EXCLUDE
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export function updateFileList(
  configName: string,
  filePath: string,
  action: FileAction,
  projectDir: string,
  rootDir: string,
): Promise<void> {
  switch (action) {
    case FileAction.INCLUDE:
      return includeFile(configName, filePath, projectDir, rootDir);
    case FileAction.EXCLUDE:
      return excludeFile(configName, filePath, projectDir, rootDir);
    default:
      return Promise.reject(new Error(`invalid file action: ${action}`));
  }
}
