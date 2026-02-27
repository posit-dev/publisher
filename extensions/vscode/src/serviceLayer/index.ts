// Copyright (C) 2025 by Posit Software, PBC.

import { workspace } from "vscode";

import { IConfigurationService } from "./interfaces";
import { getMigrationFlags } from "./featureFlags";
import { GoConfigurationService } from "./goBackend/GoConfigurationService";
import { TypeScriptConfigurationService } from "./typescript/configurations/ConfigurationService";

export interface Services {
  configurations: IConfigurationService;
  // Future: credentials, interpreters, etc.
}

let services: Services | undefined;

/**
 * Initialize the service layer. Reads migration feature flags and
 * instantiates the appropriate implementation for each service.
 *
 * VSCode-specific concerns (workspace root, settings) are resolved here
 * in the router and injected into implementations, keeping the service
 * implementations themselves decoupled from VSCode.
 */
export function initServices(): void {
  const flags = getMigrationFlags();

  let configurations: IConfigurationService;

  if (flags.useTypeScriptConfigurations) {
    const workspaceRoot = workspace.workspaceFolders?.at(0)?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error(
        "initServices: No workspace folder found for TypeScript configuration service",
      );
    }
    console.log(
      "Migration: Using TypeScript configuration service implementation",
    );
    configurations = new TypeScriptConfigurationService(workspaceRoot);
  } else {
    console.log("Migration: Using Go backend configuration service");
    configurations = new GoConfigurationService();
  }

  services = { configurations };
}

/**
 * Returns the full Services object. Must be called after initServices().
 */
export function useServices(): Services {
  if (!services) {
    throw new Error(
      "services::useServices() must be called AFTER services::initServices()",
    );
  }
  return services;
}

/**
 * Convenience accessor for the configuration service.
 */
export function useConfigurations(): IConfigurationService {
  return useServices().configurations;
}

export type { IConfigurationService, ConfigServiceErrorCode } from "./interfaces";
export { ConfigServiceError, isConfigServiceError } from "./interfaces";
export { getMigrationFlags, setMigrationFlagOverrides } from "./featureFlags";
