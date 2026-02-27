// Copyright (C) 2025 by Posit Software, PBC.

import path from "path";
import { promises as fs } from "fs";
import { parse, stringify } from "smol-toml";

import { ConfigurationDetails } from "src/api/types/configurations";

/**
 * Returns the `.posit/publish` directory path for a given base directory.
 */
export function getConfigDir(base: string): string {
  return path.join(base, ".posit", "publish");
}

/**
 * Returns the full path to a configuration TOML file.
 * Ensures the name ends with `.toml`.
 */
export function getConfigPath(base: string, configName: string): string {
  let name = configName || "default";
  if (!name.endsWith(".toml")) {
    name += ".toml";
  }
  return path.join(getConfigDir(base), name);
}

/**
 * Lists all `.toml` files in the config directory.
 * Returns an empty array if the directory doesn't exist.
 */
export async function listConfigFiles(base: string): Promise<string[]> {
  const dir = getConfigDir(base);
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((entry) => entry.endsWith(".toml"))
      .map((entry) => path.join(dir, entry));
  } catch {
    return [];
  }
}

// TOML snake_case key to TypeScript camelCase key mapping
const tomlToCamelMap: Record<string, string> = {
  $schema: "$schema",
  product_type: "productType",
  type: "type",
  entrypoint: "entrypoint",
  source: "source",
  title: "title",
  description: "description",
  thumbnail: "thumbnail",
  tags: "tags",
  validate: "validate",
  files: "files",
  secrets: "secrets",
  environment: "environment",
  python: "python",
  r: "r",
  quarto: "quarto",
  schedules: "schedules",
  access: "access",
  connect: "connect",
  integration_requests: "integrationRequests",
  alternatives: "alternatives",
  // Python/R sub-keys
  version: "version",
  package_file: "packageFile",
  package_manager: "packageManager",
  // Quarto sub-keys
  engines: "engines",
  // Schedule sub-keys
  start: "start",
  recurrence: "recurrence",
  // Access sub-keys
  users: "users",
  groups: "groups",
  id: "id",
  guid: "guid",
  name: "name",
  permissions: "permissions",
  // Connect sub-keys
  runtime: "runtime",
  kubernetes: "kubernetes",
  run_as: "runAs",
  run_as_current_user: "runAsCurrentUser",
  connection_timeout: "connectionTimeout",
  read_timeout: "readTimeout",
  init_timeout: "initTimeout",
  idle_timeout: "idleTimeout",
  max_processes: "maxProcesses",
  min_processes: "minProcesses",
  max_conns_per_process: "maxConnsPerProcess",
  load_factor: "loadFactor",
  memory_request: "memoryRequest",
  memory_limit: "memoryLimit",
  cpu_request: "cpuRequest",
  cpu_limit: "cpuLimit",
  amd_gpu_limit: "amdGpuLimit",
  nvidia_gpu_limit: "nvidiaGpuLimit",
  service_account_name: "serviceAccountName",
  default_image_name: "imageName",
  // IntegrationRequest sub-keys
  display_name: "displayName",
  display_description: "displayDescription",
  auth_type: "authType",
  config: "config",
};

// Reverse mapping: camelCase to snake_case
const camelToTomlMap: Record<string, string> = {};
for (const [tomlKey, camelKey] of Object.entries(tomlToCamelMap)) {
  camelToTomlMap[camelKey] = tomlKey;
}

/**
 * Recursively converts TOML snake_case keys to TypeScript camelCase keys.
 */
function tomlToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = tomlToCamelMap[key] ?? key;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[camelKey] = tomlToCamel(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? tomlToCamel(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Recursively converts TypeScript camelCase keys to TOML snake_case keys.
 */
function camelToToml(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const tomlKey = camelToTomlMap[key] ?? key;
    if (value === undefined) {
      continue; // skip undefined values
    }
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[tomlKey] = camelToToml(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[tomlKey] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? camelToToml(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[tomlKey] = value;
    }
  }
  return result;
}

/**
 * Reads leading comment lines (lines starting with '#') from a file.
 */
function readLeadingComments(content: string): string[] {
  const comments: string[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.startsWith("#")) {
      break;
    }
    comments.push(line);
  }
  return comments;
}

/**
 * Reads and parses a TOML configuration file into a ConfigurationDetails object.
 * Returns the parsed configuration and any leading comments.
 */
export async function readConfig(
  filePath: string,
): Promise<{ config: ConfigurationDetails; comments: string[] }> {
  const content = await fs.readFile(filePath, "utf-8");
  const comments = readLeadingComments(content);
  const parsed = parse(content);
  const camelCased = tomlToCamel(parsed as Record<string, unknown>);
  return {
    config: camelCased as unknown as ConfigurationDetails,
    comments,
  };
}

/**
 * Serializes a ConfigurationDetails object to TOML and writes it to disk.
 * Preserves leading comments if provided.
 */
export async function writeConfig(
  filePath: string,
  config: ConfigurationDetails,
  comments?: string[],
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const snakeCased = camelToToml(config as unknown as Record<string, unknown>);
  const tomlContent = stringify(snakeCased);

  let output = "";
  if (comments && comments.length > 0) {
    output = comments.join("\n") + "\n";
  }
  output += tomlContent;

  await fs.writeFile(filePath, output, "utf-8");
}

// Export the mapping functions for testing
export { tomlToCamel as _tomlToCamel, camelToToml as _camelToToml };
