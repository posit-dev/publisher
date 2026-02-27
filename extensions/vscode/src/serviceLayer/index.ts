// Copyright (C) 2025 by Posit Software, PBC.

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
 * The Go backend adapter uses useApi() internally, so no client
 * parameter is needed here.
 */
export function initServices(): void {
  const flags = getMigrationFlags();

  let configurations: IConfigurationService;

  if (flags.useTypeScriptConfigurations) {
    console.log(
      "Migration: Using TypeScript configuration service implementation",
    );
    configurations = new TypeScriptConfigurationService();
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

export type { IConfigurationService } from "./interfaces";
export { getMigrationFlags, setMigrationFlagOverrides } from "./featureFlags";
