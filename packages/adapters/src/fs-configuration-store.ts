// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as TOML from "smol-toml";

import type { Configuration, ConfigurationStore } from "@publisher/core";
import {
  ConfigurationNotFoundError,
  ConfigurationReadError,
} from "@publisher/core";

import {
  camelToSnake,
  snakeToCamel,
  transformKeys,
} from "./key-transform.js";

const CONFIG_DIR = path.join(".posit", "publish");

/**
 * Driven adapter: ConfigurationStore backed by TOML files on disk.
 *
 * Configurations are stored as `.posit/publish/<name>.toml` files.
 * This adapter handles:
 * - TOML parsing and serialization
 * - snake_case ↔ camelCase key translation
 * - Filesystem error translation to domain errors
 */
export class FsConfigurationStore implements ConfigurationStore {
  async list(projectDir: string): Promise<string[]> {
    const configDir = path.join(projectDir, CONFIG_DIR);

    let entries: string[];
    try {
      entries = await fs.readdir(configDir);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        // No .posit/publish/ directory means no configurations
        return [];
      }
      throw error;
    }

    return entries
      .filter((entry) => entry.endsWith(".toml"))
      .map((entry) => entry.replace(/\.toml$/, ""));
  }

  async read(projectDir: string, name: string): Promise<Configuration> {
    const filePath = configPath(projectDir, name);

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new ConfigurationNotFoundError(name, { cause: error });
      }
      throw new ConfigurationReadError(name, "failed to read file", {
        cause: error,
      });
    }

    try {
      const raw = TOML.parse(content);
      // TODO: Validate the parsed data against the Configuration schema
      // before returning. The `as Configuration` assertion has no runtime
      // effect — if the TOML contains unexpected data (wrong types, missing
      // fields), the mismatch won't be caught here. The Go backend validates
      // against `posit-publishing-schema-v3.json`; this adapter should do
      // the same.
      return transformKeys(raw, snakeToCamel) as Configuration;
    } catch (error) {
      throw new ConfigurationReadError(name, "invalid TOML", {
        cause: error,
      });
    }
  }

  async write(
    projectDir: string,
    name: string,
    config: Configuration,
  ): Promise<void> {
    const filePath = configPath(projectDir, name);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    const snakeCased = transformKeys(config, camelToSnake) as Record<
      string,
      unknown
    >;
    const content = TOML.stringify(snakeCased);
    await fs.writeFile(filePath, content, "utf-8");
  }

  async remove(projectDir: string, name: string): Promise<void> {
    const filePath = configPath(projectDir, name);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new ConfigurationNotFoundError(name, { cause: error });
      }
      throw error;
    }
  }
}

function configPath(projectDir: string, name: string): string {
  const filename = name.endsWith(".toml") ? name : `${name}.toml`;
  return path.join(projectDir, CONFIG_DIR, filename);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
