// Copyright (C) 2025 by Posit Software, PBC.

import { useApi } from "src/api";
import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "src/api/types/configurations";
import { IConfigurationService } from "../interfaces";

/**
 * Go backend adapter: delegates to the existing API resource classes
 * via useApi() to conform to the IConfigurationService interface.
 * Each method calls through to the Go backend HTTP API and unwraps
 * the AxiosResponse to return plain data.
 */
export class GoConfigurationService implements IConfigurationService {
  async getAll(
    dir: string,
    params?: { entrypoint?: string; recursive?: boolean },
  ): Promise<Array<Configuration | ConfigurationError>> {
    const api = await useApi();
    const response = await api.configurations.getAll(dir, params);
    return response.data;
  }

  async get(
    configName: string,
    dir: string,
  ): Promise<Configuration | ConfigurationError> {
    const api = await useApi();
    const response = await api.configurations.get(configName, dir);
    return response.data;
  }

  async createOrUpdate(
    configName: string,
    cfg: ConfigurationDetails,
    dir: string,
  ): Promise<Configuration> {
    const api = await useApi();
    const response = await api.configurations.createOrUpdate(
      configName,
      cfg,
      dir,
    );
    return response.data;
  }

  async delete(configName: string, dir: string): Promise<void> {
    const api = await useApi();
    await api.configurations.delete(configName, dir);
  }

  async getSecrets(configName: string, dir: string): Promise<string[]> {
    const api = await useApi();
    const response = await api.secrets.get(configName, dir);
    return response.data;
  }

  async addSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    const api = await useApi();
    const response = await api.secrets.add(configName, secretName, dir);
    return response.data;
  }

  async removeSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    const api = await useApi();
    const response = await api.secrets.remove(configName, secretName, dir);
    return response.data;
  }
}
