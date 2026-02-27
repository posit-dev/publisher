// Copyright (C) 2025 by Posit Software, PBC.

import path from "path";
import { promises as fs } from "fs";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "src/api/types/configurations";
import { IConfigurationService, ConfigServiceError } from "../../interfaces";
import {
  getConfigDir,
  getConfigPath,
  listConfigFiles,
  readConfig,
  writeConfig,
} from "./tomlConfig";

/**
 * Translates a filesystem or TOML parse error into a ConfigServiceError.
 */
function translateError(err: unknown): never {
  if (err instanceof ConfigServiceError) {
    throw err;
  }
  const nodeErr = err as NodeJS.ErrnoException;
  if (nodeErr.code === "ENOENT") {
    throw new ConfigServiceError("not-found", nodeErr.message, err);
  }
  if (err instanceof Error) {
    throw new ConfigServiceError("unknown", err.message, err);
  }
  throw new ConfigServiceError("unknown", String(err), err);
}

/**
 * Extracts the configuration name from a TOML file path (filename without .toml extension).
 */
function configNameFromPath(filePath: string): string {
  return path.basename(filePath, ".toml");
}

/**
 * TypeScript-native implementation of the Configuration service.
 * Reads and writes `.posit/publish/*.toml` files directly on disk.
 *
 * This class has no dependency on the `vscode` module. The workspace root
 * is injected via the constructor, keeping the implementation portable
 * and testable without VSCode mocks.
 */
export class TypeScriptConfigurationService implements IConfigurationService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Resolves a directory parameter (which may be relative, e.g. ".") to an
   * absolute filesystem path using the injected workspace root.
   */
  private resolveDir(dir: string): string {
    if (path.isAbsolute(dir)) {
      return dir;
    }
    return path.resolve(this.workspaceRoot, dir);
  }

  /**
   * Builds configuration location metadata from a base directory and config name.
   */
  private buildConfigLocation(
    absoluteDir: string,
    configName: string,
    configPath: string,
  ): {
    configurationName: string;
    configurationPath: string;
    configurationRelPath: string;
    projectDir: string;
  } {
    const relPath = path.relative(this.workspaceRoot, configPath);
    const projectDir =
      path.relative(this.workspaceRoot, absoluteDir) || ".";

    return {
      configurationName: configName,
      configurationPath: configPath,
      configurationRelPath: relPath,
      projectDir,
    };
  }

  async getAll(
    dir: string,
    params?: { entrypoint?: string; recursive?: boolean },
  ): Promise<Array<Configuration | ConfigurationError>> {
    const absoluteDir = this.resolveDir(dir);
    const results: Array<Configuration | ConfigurationError> = [];

    if (params?.recursive) {
      // Walk subdirectories looking for .posit/publish/*.toml
      await this.collectConfigsRecursive(absoluteDir, absoluteDir, results);
    } else {
      const files = await listConfigFiles(absoluteDir);
      for (const filePath of files) {
        const configName = configNameFromPath(filePath);
        const location = this.buildConfigLocation(
          absoluteDir,
          configName,
          filePath,
        );
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
    const absoluteDir = this.resolveDir(dir);
    const configPath = getConfigPath(absoluteDir, configName);
    const location = this.buildConfigLocation(
      absoluteDir,
      configName,
      configPath,
    );

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
    const absoluteDir = this.resolveDir(dir);
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

    const location = this.buildConfigLocation(
      absoluteDir,
      configName,
      configPath,
    );
    return { ...location, configuration: cfg };
  }

  async delete(configName: string, dir: string): Promise<void> {
    try {
      const absoluteDir = this.resolveDir(dir);
      const configPath = getConfigPath(absoluteDir, configName);
      await fs.unlink(configPath);
    } catch (err) {
      translateError(err);
    }
  }

  async getSecrets(configName: string, dir: string): Promise<string[]> {
    try {
      const absoluteDir = this.resolveDir(dir);
      const configPath = getConfigPath(absoluteDir, configName);
      const { config } = await readConfig(configPath);
      return config.secrets ?? [];
    } catch (err) {
      translateError(err);
    }
  }

  async addSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    try {
      const absoluteDir = this.resolveDir(dir);
      const configPath = getConfigPath(absoluteDir, configName);
      const { config, comments } = await readConfig(configPath);

      if (!config.secrets) {
        config.secrets = [];
      }
      if (!config.secrets.includes(secretName)) {
        config.secrets.push(secretName);
      }

      await writeConfig(configPath, config, comments);

      const location = this.buildConfigLocation(
        absoluteDir,
        configName,
        configPath,
      );
      return { ...location, configuration: config };
    } catch (err) {
      translateError(err);
    }
  }

  async removeSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    try {
      const absoluteDir = this.resolveDir(dir);
      const configPath = getConfigPath(absoluteDir, configName);
      const { config, comments } = await readConfig(configPath);

      if (config.secrets) {
        config.secrets = config.secrets.filter((s) => s !== secretName);
      }

      await writeConfig(configPath, config, comments);

      const location = this.buildConfigLocation(
        absoluteDir,
        configName,
        configPath,
      );
      return { ...location, configuration: config };
    } catch (err) {
      translateError(err);
    }
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
        const location = this.buildConfigLocation(
          searchDir,
          configName,
          filePath,
        );
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
