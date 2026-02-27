// Copyright (C) 2025 by Posit Software, PBC.

import { isAxiosError } from "axios";

import { useApi } from "src/api";
import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "src/api/types/configurations";
import {
  IConfigurationService,
  ConfigServiceError,
  ConfigServiceErrorCode,
} from "../interfaces";

/**
 * Translates an axios error into a ConfigServiceError so that call sites
 * don't need to depend on axios error shapes.
 */
function translateError(err: unknown): never {
  if (isAxiosError(err)) {
    let code: ConfigServiceErrorCode = "unknown";
    if (err.response?.status === 404) {
      code = "not-found";
    }
    throw new ConfigServiceError(
      code,
      err.response?.data || err.message,
      err,
    );
  }
  if (err instanceof Error) {
    throw new ConfigServiceError("unknown", err.message, err);
  }
  throw new ConfigServiceError("unknown", String(err), err);
}

/**
 * Go backend adapter: delegates to the existing API resource classes
 * via useApi() to conform to the IConfigurationService interface.
 * Each method calls through to the Go backend HTTP API, unwraps the
 * AxiosResponse, and translates axios errors into ConfigServiceError.
 */
export class GoConfigurationService implements IConfigurationService {
  async getAll(
    dir: string,
    params?: { entrypoint?: string; recursive?: boolean },
  ): Promise<Array<Configuration | ConfigurationError>> {
    try {
      const api = await useApi();
      const response = await api.configurations.getAll(dir, params);
      return response.data;
    } catch (err) {
      translateError(err);
    }
  }

  async get(
    configName: string,
    dir: string,
  ): Promise<Configuration | ConfigurationError> {
    try {
      const api = await useApi();
      const response = await api.configurations.get(configName, dir);
      return response.data;
    } catch (err) {
      translateError(err);
    }
  }

  async createOrUpdate(
    configName: string,
    cfg: ConfigurationDetails,
    dir: string,
  ): Promise<Configuration> {
    try {
      const api = await useApi();
      const response = await api.configurations.createOrUpdate(
        configName,
        cfg,
        dir,
      );
      return response.data;
    } catch (err) {
      translateError(err);
    }
  }

  async delete(configName: string, dir: string): Promise<void> {
    try {
      const api = await useApi();
      await api.configurations.delete(configName, dir);
    } catch (err) {
      translateError(err);
    }
  }

  async getSecrets(configName: string, dir: string): Promise<string[]> {
    try {
      const api = await useApi();
      const response = await api.secrets.get(configName, dir);
      return response.data;
    } catch (err) {
      translateError(err);
    }
  }

  async addSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    try {
      const api = await useApi();
      const response = await api.secrets.add(configName, secretName, dir);
      return response.data;
    } catch (err) {
      translateError(err);
    }
  }

  async removeSecret(
    configName: string,
    secretName: string,
    dir: string,
  ): Promise<Configuration> {
    try {
      const api = await useApi();
      const response = await api.secrets.remove(configName, secretName, dir);
      return response.data;
    } catch (err) {
      translateError(err);
    }
  }
}
