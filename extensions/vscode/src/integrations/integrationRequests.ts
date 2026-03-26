// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";

import { IntegrationRequest } from "../api/types/configurations";
import { getConfigPath } from "../toml/configDiscovery";
import { loadConfigFromFile } from "../toml/configLoader";
import { writeConfigToFile } from "../toml/configWriter";

/**
 * List integration requests from a configuration file.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 * @returns Array of integration requests (empty if none defined)
 */
export async function listIntegrationRequests(
  configName: string,
  projectDir: string,
  rootDir: string,
): Promise<IntegrationRequest[]> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  const relDir = relativeProjectDir(absDir, rootDir);
  const cfg = await loadConfigFromFile(configPath, relDir);
  return cfg.configuration.integrationRequests ?? [];
}

/**
 * Add an integration request to a configuration file.
 * If the exact same request already exists, this is a no-op.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 * @param request - The integration request to add
 */
export async function addIntegrationRequest(
  configName: string,
  projectDir: string,
  rootDir: string,
  request: IntegrationRequest,
): Promise<void> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  const relDir = relativeProjectDir(absDir, rootDir);
  const cfg = await loadConfigFromFile(configPath, relDir);

  const existing = cfg.configuration.integrationRequests ?? [];

  // Skip if an identical request already exists
  if (existing.some((ir) => integrationRequestsEqual(ir, request))) {
    return;
  }

  cfg.configuration.integrationRequests = [...existing, request];
  await writeConfigToFile(configName, projectDir, rootDir, cfg.configuration);
}

/**
 * Remove an integration request from a configuration file.
 * Matches by deep equality. If no match is found, this is a no-op.
 *
 * @param configName - Name of the configuration (without .toml extension)
 * @param projectDir - Relative project directory (e.g., "." or "subdir")
 * @param rootDir - Absolute workspace root directory
 * @param request - The integration request to remove
 */
export async function removeIntegrationRequest(
  configName: string,
  projectDir: string,
  rootDir: string,
  request: IntegrationRequest,
): Promise<void> {
  const absDir = path.resolve(rootDir, projectDir);
  const configPath = getConfigPath(absDir, configName);
  const relDir = relativeProjectDir(absDir, rootDir);
  const cfg = await loadConfigFromFile(configPath, relDir);

  const existing = cfg.configuration.integrationRequests ?? [];
  const filtered = existing.filter(
    (ir) => !integrationRequestsEqual(ir, request),
  );

  cfg.configuration.integrationRequests = filtered;
  await writeConfigToFile(configName, projectDir, rootDir, cfg.configuration);
}

/**
 * Compare two integration requests for equality.
 * Uses JSON serialization with sorted keys for deep comparison,
 * matching the Go reflect.DeepEqual behavior.
 */
function integrationRequestsEqual(
  a: IntegrationRequest,
  b: IntegrationRequest,
): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(obj: IntegrationRequest): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function relativeProjectDir(absDir: string, rootDir: string): string {
  const rel = path.relative(rootDir, absDir);
  return rel === "" ? "." : rel;
}
