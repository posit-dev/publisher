// Copyright (C) 2025 by Posit Software, PBC.

import path from "path";
import { promises as fs } from "fs";
import { workspace } from "vscode";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "src/api/types/configurations";
import { IConfigurationService } from "../../interfaces";
import {
  getConfigDir,
  getConfigPath,
  listConfigFiles,
  readConfig,
  writeConfig,
} from "./tomlConfig";

/**
 * Resolves a directory parameter (which may be relative, e.g. ".") to an
 * absolute filesystem path using the first workspace folder as the base.
 */
function resolveDir(dir: string): string {
  if (path.isAbsolute(dir)) {
    return dir;
  }
  const workspaceRoot = workspace.workspaceFolders?.at(0)?.uri.fsPath;
  if (!workspaceRoot) {
    throw new Error(
      "No workspace folder found. Cannot resolve relative directory.",
    );
  }
  return path.resolve(workspaceRoot, dir);
}

/**
 * Extracts the configuration name from a TOML file path (filename without .toml extension).
 */
function configNameFromPath(filePath: string): string {
  return path.basename(filePath, ".toml");
}

/**
 * Builds configuration location metadata from a base directory and config name.
 */
function buildConfigLocation(
  absoluteDir: string,
  configName: string,
  configPath: string,
): {
  configurationName: string;
  configurationPath: string;
  configurationRelPath: string;
  projectDir: string;
} {
  const workspaceRoot = workspace.workspaceFolders?.at(0)?.uri.fsPath || "";
  const relPath = workspaceRoot
    ? path.relative(workspaceRoot, configPath)
    : configPath;
  const projectDir = workspaceRoot
    ? path.relative(workspaceRoot, absoluteDir) || "."
    : absoluteDir;

  return {
    configurationName: configName,
    configurationPath: configPath,
    configurationRelPath: relPath,
    projectDir,
  };
}

/**
 * TypeScript-native implementation of the Configuration service.
 * Reads and writes `.posit/publish/*.toml` files directly on disk.
 */
export class TypeScriptConfigurationService implements IConfigurationService {
  async getAll(
    dir: string,
    params?: { entrypoint?: string; recursive?: boolean },
  ): Promise<Array<Configuration | ConfigurationError>> {
    const absoluteDir = resolveDir(dir);
    const results: Array<Configuration | ConfigurationError> = [];

    if (params?.recursive) {
      // Walk subdirectories looking for .posit/publish/*.toml
      await this.collectConfigsRecursive(absoluteDir, absoluteDir, results);
    } else {
      const files = await listConfigFiles(absoluteDir);
      for (const filePath of files) {
        const configName = configNameFromPath(filePath);
        const location = buildConfigLocation(absoluteDir, configName, filePath);
        try {
          const { config } = await readConfig(filePath);
          results.push({ ...location, configuration: config });
        } catch (error: unknown) {
          results.push({
            ...location,
            error: {
              code: "invalidTOML",
              msg:
                error instanceof Error ? error.message : "Failed to parse TOML",
              operation: "getAll",
            },
          });
        }
      }
    }

    return results;
  }

  async get(
    configName: string,
    dir: string,
  ): Promise<Configuration | ConfigurationError> {
    const absoluteDir = resolveDir(dir);
    const configPath = getConfigPath(absoluteDir, configName);
    const location = buildConfigLocation(absoluteDir, configName, configPath);

    try {
      const { config } = await readConfig(configPath);
      return { ...location, configuration: config };
    } catch (error: unknown) {
      return {
        ...location,
        error: {
          code: "invalidTOML",
          msg:
            error instanceof Error ? error.message : "Failed to read config",
          operation: "get",
        },
      };
    }
  }

  async createOrUpdate(
    configName: string,
    cfg: ConfigurationDetails,
    dir: string,
  ): Promise<Configuration> {
    const absoluteDir = resolveDir(dir);
    const configPath = getConfigPath(absoluteDir, configName);

    // Try to preserve existing leading comments
    let comments: string[] | undefined;
    try {
      const existing = await readConfig(configPath);
      comments = existing.comments;
    } catch {
      // File doesn't exist yet - no comments to preserve
    }

    await writeConfig(configPath, cfg, comments);

    const location = buildConfigLocation(absoluteDir, configName, configPath);
    return { ...location, configuration: cfg };
  }

  async delete(configName: string, dir: string): Promise<void> {
    const absoluteDir = resolveDir(dir);
    const configPath = getConfigPath(absoluteDir, configName);
    await fs.unlink(configPath);
  }

  async getSecrets(configName: string, dir: string): Promise<string[]> {
    const absoluteDir = resolveDir(dir);
    const configPath = getConfigPath(absoluteDir, configName);
    const { config } = await readConfig(configPath);
    return config.secrets ?? [];
  }

  async addSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    const absoluteDir = resolveDir(dir);
    const configPath = getConfigPath(absoluteDir, configName);
    const { config, comments } = await readConfig(configPath);

    if (!config.secrets) {
      config.secrets = [];
    }
    if (!config.secrets.includes(secretName)) {
      config.secrets.push(secretName);
    }

    await writeConfig(configPath, config, comments);

    const location = buildConfigLocation(absoluteDir, configName, configPath);
    return { ...location, configuration: config };
  }

  async removeSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    const absoluteDir = resolveDir(dir);
    const configPath = getConfigPath(absoluteDir, configName);
    const { config, comments } = await readConfig(configPath);

    if (config.secrets) {
      config.secrets = config.secrets.filter((s) => s !== secretName);
    }

    await writeConfig(configPath, config, comments);

    const location = buildConfigLocation(absoluteDir, configName, configPath);
    return { ...location, configuration: config };
  }

  /**
   * Recursively search for configuration files in subdirectories.
   */
  private async collectConfigsRecursive(
    searchDir: string,
    rootDir: string,
    results: Array<Configuration | ConfigurationError>,
  ): Promise<void> {
    // Check for configs in this directory
    const configDir = getConfigDir(searchDir);
    try {
      await fs.access(configDir);
      const files = await listConfigFiles(searchDir);
      for (const filePath of files) {
        const configName = configNameFromPath(filePath);
        const location = buildConfigLocation(searchDir, configName, filePath);
        try {
          const { config } = await readConfig(filePath);
          results.push({ ...location, configuration: config });
        } catch (error: unknown) {
          results.push({
            ...location,
            error: {
              code: "invalidTOML",
              msg:
                error instanceof Error
                  ? error.message
                  : "Failed to parse TOML",
              operation: "getAll",
            },
          });
        }
      }
    } catch {
      // No config directory here, that's fine
    }

    // Recurse into subdirectories
    try {
      const entries = await fs.readdir(searchDir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules" &&
          entry.name !== "__pycache__" &&
          entry.name !== ".git"
        ) {
          await this.collectConfigsRecursive(
            path.join(searchDir, entry.name),
            rootDir,
            results,
          );
        }
      }
    } catch {
      // Can't read directory, skip
    }
  }
}
