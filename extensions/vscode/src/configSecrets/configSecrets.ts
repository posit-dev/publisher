// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";

import { getConfigPath } from "../toml/configDiscovery";
import { loadConfigFromFile } from "../toml/configLoader";
import { writeConfigToFile } from "../toml/configWriter";
import { relativeProjectDir } from "../toml/tomlHelpers";

/**
 * Add a secret name to a configuration's secrets list.
 *
 * - If the secret already exists in `secrets[]`, this is a no-op.
 * - If the secret name conflicts with an `environment` key, throws an error.
 *
 * Matches Go's `Config.AddSecret` behavior.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param secretName - The secret name to add
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export async function addSecret(
  configName: string,
  secretName: string,
  projectDir: string,
  rootDir: string,
): Promise<void> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  const relDir = relativeProjectDir(absDir, rootDir);
  const cfg = await loadConfigFromFile(configPath, relDir);

  const secrets = cfg.configuration.secrets ?? [];

  // Idempotent: skip if already present
  if (secrets.includes(secretName)) {
    return;
  }

  // Validate: secret name must not conflict with environment keys
  const environment = cfg.configuration.environment ?? {};
  if (secretName in environment) {
    throw new Error("secret name already exists in environment");
  }

  cfg.configuration.secrets = [...secrets, secretName];
  await writeConfigToFile(configName, projectDir, rootDir, cfg.configuration);
}

/**
 * Remove a secret name from a configuration's secrets list.
 *
 * If the secret is not present, this is a no-op.
 *
 * Matches Go's `Config.RemoveSecret` behavior.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param secretName - The secret name to remove
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 */
export async function removeSecret(
  configName: string,
  secretName: string,
  projectDir: string,
  rootDir: string,
): Promise<void> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  const relDir = relativeProjectDir(absDir, rootDir);
  const cfg = await loadConfigFromFile(configPath, relDir);

  const secrets = cfg.configuration.secrets ?? [];
  const index = secrets.indexOf(secretName);

  if (index === -1) {
    return;
  }

  cfg.configuration.secrets = [
    ...secrets.slice(0, index),
    ...secrets.slice(index + 1),
  ];
  await writeConfigToFile(configName, projectDir, rootDir, cfg.configuration);
}
