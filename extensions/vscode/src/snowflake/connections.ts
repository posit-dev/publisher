// Copyright (C) 2026 by Posit Software, PBC.

import fs from "fs";
import os from "os";
import path from "path";
import { parse } from "smol-toml";

import type { SnowflakeConnectionConfig } from "./types";

/** Known fields on a Snowflake connection that can be overridden via env vars. */
const OVERRIDABLE_FIELDS: {
  envSuffix: string;
  field: keyof SnowflakeConnectionConfig;
}[] = [
  { envSuffix: "ACCOUNT", field: "account" },
  { envSuffix: "USER", field: "user" },
  { envSuffix: "PRIVATE_KEY_FILE", field: "private_key_file" },
  { envSuffix: "PRIVATE_KEY_PATH", field: "private_key_path" },
  { envSuffix: "TOKEN", field: "token" },
  { envSuffix: "AUTHENTICATOR", field: "authenticator" },
];

/**
 * Returns potential config directories for Snowflake connections.
 * Matches the Go implementation's search order.
 */
function findConfigDirs(): string[] {
  const dirs: string[] = [];

  const snowflakeHome = process.env.SNOWFLAKE_HOME;
  if (snowflakeHome) {
    dirs.push(snowflakeHome);
  }

  const home = os.homedir();

  dirs.push(path.join(home, ".snowflake"));

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    dirs.push(path.join(xdgConfigHome, "snowflake"));
  }

  switch (process.platform) {
    case "win32":
      dirs.push(path.join(home, "AppData", "Local", "snowflake"));
      break;
    case "darwin":
      dirs.push(path.join(home, "Library", "Application Support", "snowflake"));
      break;
    case "linux":
      dirs.push(path.join(home, ".config", "snowflake"));
      break;
  }

  return dirs;
}

/**
 * Searches config directories for connections.toml or config.toml.
 * connections.toml takes priority. Returns null if no file found.
 */
function findConfigFile(): { path: string; isConfigToml: boolean } | null {
  const dirs = findConfigDirs();

  // First pass: look for connections.toml
  for (const dir of dirs) {
    const filePath = path.join(dir, "connections.toml");
    if (fs.existsSync(filePath)) {
      return { path: filePath, isConfigToml: false };
    }
  }

  // Second pass: look for config.toml
  for (const dir of dirs) {
    const filePath = path.join(dir, "config.toml");
    if (fs.existsSync(filePath)) {
      return { path: filePath, isConfigToml: true };
    }
  }

  return null;
}

/**
 * Parses connections.toml format where each connection is a top-level section.
 * e.g., [default], [other]
 */
function parseConnectionsToml(
  content: string,
): Record<string, SnowflakeConnectionConfig> {
  const parsed = parse(content) as Record<string, Record<string, unknown>>;
  const result: Record<string, SnowflakeConnectionConfig> = {};

  for (const [name, fields] of Object.entries(parsed)) {
    if (typeof fields === "object" && fields !== null) {
      result[name] = fields as unknown as SnowflakeConnectionConfig;
    }
  }

  return result;
}

/**
 * Parses config.toml format where connections are nested under [connections].
 * e.g., [connections.default], [connections.other]
 */
function parseConfigToml(
  content: string,
): Record<string, SnowflakeConnectionConfig> {
  const parsed = parse(content) as {
    connections?: Record<string, Record<string, unknown>>;
  };

  if (!parsed.connections) {
    return {};
  }

  const result: Record<string, SnowflakeConnectionConfig> = {};
  for (const [name, fields] of Object.entries(parsed.connections)) {
    if (typeof fields === "object" && fields !== null) {
      result[name] = fields as unknown as SnowflakeConnectionConfig;
    }
  }

  return result;
}

/**
 * Applies environment variable overrides to parsed connections.
 * Format: SNOWFLAKE_CONNECTIONS_<NAME>_<FIELD>
 */
function applyEnvVarOverrides(
  conns: Record<string, SnowflakeConnectionConfig>,
): void {
  for (const [name, conn] of Object.entries(conns)) {
    for (const { envSuffix, field } of OVERRIDABLE_FIELDS) {
      const envVar = `SNOWFLAKE_CONNECTIONS_${name.toUpperCase()}_${envSuffix}`;
      const value = process.env[envVar];
      if (value !== undefined) {
        (conn as Record<string, unknown>)[field] = value;
      }
    }
  }
}

/**
 * Normalizes private_key_path to private_key_file when private_key_file is not set.
 */
function normalizeKeyPaths(
  conns: Record<string, SnowflakeConnectionConfig>,
): void {
  for (const conn of Object.values(conns)) {
    if (!conn.private_key_file && conn.private_key_path) {
      conn.private_key_file = conn.private_key_path;
    }
    // Clean up the alternate field
    delete conn.private_key_path;
  }
}

/**
 * Lists all configured Snowflake connections by searching for config files
 * and applying environment variable overrides.
 *
 * Returns an empty object if no config file is found.
 */
export function listConnections(): Record<string, SnowflakeConnectionConfig> {
  const configFile = findConfigFile();
  if (!configFile) {
    return {};
  }

  const content = fs.readFileSync(configFile.path, "utf-8");

  const conns = configFile.isConfigToml
    ? parseConfigToml(content)
    : parseConnectionsToml(content);

  normalizeKeyPaths(conns);
  applyEnvVarOverrides(conns);

  return conns;
}
