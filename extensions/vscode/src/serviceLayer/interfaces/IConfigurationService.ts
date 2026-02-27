// Copyright (C) 2025 by Posit Software, PBC.

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "src/api/types/configurations";

/**
 * Service contract for configuration CRUD operations.
 * Both the Go backend adapter and TypeScript implementation must satisfy this interface.
 */
export interface IConfigurationService {
  getAll(
    dir: string,
    params?: { entrypoint?: string; recursive?: boolean },
  ): Promise<Array<Configuration | ConfigurationError>>;

  get(
    configName: string,
    dir: string,
  ): Promise<Configuration | ConfigurationError>;

  createOrUpdate(
    configName: string,
    cfg: ConfigurationDetails,
    dir: string,
  ): Promise<Configuration>;

  delete(configName: string, dir: string): Promise<void>;

  getSecrets(configName: string, dir: string): Promise<string[]>;

  addSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration>;

  removeSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration>;
}
