// Copyright (C) 2026 by Posit Software, PBC.

import type { Configuration } from "./types.js";

/**
 * Driven (secondary) port — the core's interface for reading and writing
 * deployment configurations.
 *
 * Implementations handle the infrastructure details: file system access,
 * TOML parsing/serialization, schema validation, etc. The core only sees
 * domain types.
 *
 * Errors:
 * - `list` returns config names; it should not throw if individual files
 *    are unreadable (that's handled at the `read` level).
 * - `read` throws `ConfigurationNotFoundError` if the name doesn't exist,
 *    or `ConfigurationReadError` if the file exists but can't be parsed.
 * - `write` creates the file (and parent directories) if needed.
 * - `remove` throws `ConfigurationNotFoundError` if the name doesn't exist.
 */
export interface ConfigurationStore {
  /** List configuration names for a project directory. */
  list(projectDir: string): Promise<string[]>;

  /** Read and parse a single configuration by name. */
  read(projectDir: string, name: string): Promise<Configuration>;

  /** Write a configuration, creating or overwriting the file. */
  write(
    projectDir: string,
    name: string,
    config: Configuration,
  ): Promise<void>;

  /** Delete a configuration by name. */
  remove(projectDir: string, name: string): Promise<void>;
}
