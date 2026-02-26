// Copyright (C) 2026 by Posit Software, PBC.

import {
  type Configuration as CoreConfiguration,
  type ConfigurationStore,
  ConfigurationNotFoundError,
  ConfigurationReadError,
} from "@publisher/core";

import { useApi } from "src/api";
import {
  isConfigurationError,
  type ContentType as ApiContentType,
} from "src/api/types/configurations";
import type {
  Configuration as ApiConfiguration,
  ConfigurationDetails,
} from "src/api/types/configurations";
import type { ProductType as ApiProductType } from "src/api/types/contentRecords";

/**
 * Go API adapter: implements ConfigurationStore by delegating to the
 * existing Go backend REST API.
 *
 * This is a **migration adapter** — it exists so the extension can be
 * wired through the port interface while still using the Go backend.
 * Once the Go backend is decommissioned, this adapter is deleted and
 * replaced by the FsConfigurationStore from @publisher/adapters.
 *
 * The adapter translates between:
 * - Go API response types (ConfigurationLocation + ConfigurationDetails)
 * - Core domain types (Configuration)
 * - Axios errors → domain errors
 */
export class GoApiConfigurationStore implements ConfigurationStore {
  async list(projectDir: string): Promise<string[]> {
    const api = await useApi();
    const response = await api.configurations.getAll(projectDir);
    return response.data.map((entry) => entry.configurationName);
  }

  async read(
    projectDir: string,
    name: string,
  ): Promise<CoreConfiguration> {
    const api = await useApi();

    let response;
    try {
      response = await api.configurations.get(name, projectDir);
    } catch (error) {
      throw translateError(name, error);
    }

    const entry = response.data;
    if (isConfigurationError(entry)) {
      throw new ConfigurationReadError(name, entry.error.msg);
    }

    return toCoreDomain(entry);
  }

  async write(
    projectDir: string,
    name: string,
    config: CoreConfiguration,
  ): Promise<void> {
    const api = await useApi();
    const details = fromCoreDomain(config);

    try {
      await api.configurations.createOrUpdate(name, details, projectDir);
    } catch (error) {
      throw translateError(name, error);
    }
  }

  async remove(projectDir: string, name: string): Promise<void> {
    const api = await useApi();

    try {
      await api.configurations.delete(name, projectDir);
    } catch (error) {
      throw translateError(name, error);
    }
  }
}

// --- Type translation ---

/**
 * Translate a Go API Configuration response into a core domain Configuration.
 *
 * The Go API wraps the config details in an envelope with location metadata
 * (configurationName, configurationPath, projectDir). The core domain type
 * is just the details.
 */
function toCoreDomain(apiConfig: ApiConfiguration): CoreConfiguration {
  const d = apiConfig.configuration;
  return {
    "$schema": d.$schema,
    productType: d.productType,
    type: d.type,
    entrypoint: d.entrypoint,
    source: d.source,
    title: d.title,
    description: d.description,
    thumbnail: d.thumbnail,
    tags: d.tags,
    validate: d.validate,
    files: d.files,
    secrets: d.secrets,
    python: d.python,
    r: d.r,
    quarto: d.quarto,
    environment: d.environment,
    schedules: d.schedules,
    connect: d.connect,
    integrationRequests: d.integrationRequests,
  };
}

/**
 * Translate a core domain Configuration into the ConfigurationDetails
 * shape expected by the Go API's PUT endpoint.
 */
function fromCoreDomain(config: CoreConfiguration): ConfigurationDetails {
  return {
    $schema: config["$schema"] ?? "",
    // The core uses string unions; the Go API types use TypeScript enums.
    // The underlying string values are identical, so these casts are safe.
    productType: (config.productType ?? "connect") as ApiProductType,
    type: config.type as ApiContentType,
    entrypoint: config.entrypoint,
    source: config.source,
    title: config.title,
    description: config.description,
    thumbnail: config.thumbnail,
    tags: config.tags,
    validate: config.validate ?? false,
    files: config.files,
    secrets: config.secrets,
    python: config.python
      ? {
          version: config.python.version ?? "",
          packageFile: config.python.packageFile ?? "",
          packageManager: config.python.packageManager ?? "",
        }
      : undefined,
    r: config.r
      ? {
          version: config.r.version ?? "",
          packageFile: config.r.packageFile ?? "",
          packageManager: config.r.packageManager ?? "",
        }
      : undefined,
    quarto: config.quarto
      ? {
          version: config.quarto.version ?? "",
          engines: config.quarto.engines,
        }
      : undefined,
    environment: config.environment,
    // Core Schedule fields are optional; Go API requires them.
    schedules: config.schedules?.map((s) => ({
      start: s.start ?? "",
      recurrence: s.recurrence ?? "",
    })),
    connect: config.connect,
    // Core uses Record<string, unknown> for config; Go API uses
    // Record<string, string | undefined>. Safe to cast since the Go API
    // only stores string values.
    integrationRequests:
      config.integrationRequests as ConfigurationDetails["integrationRequests"],
  };
}

// --- Error translation ---

function translateError(name: string, error: unknown): Error {
  if (isAxios404(error)) {
    return new ConfigurationNotFoundError(name, { cause: error });
  }
  if (isAxiosError(error)) {
    const msg =
      typeof error.response?.data === "string"
        ? error.response.data
        : error.message;
    return new ConfigurationReadError(name, msg, { cause: error });
  }
  if (error instanceof Error) {
    return new ConfigurationReadError(name, error.message, { cause: error });
  }
  return new ConfigurationReadError(name, String(error));
}

function isAxiosError(
  error: unknown,
): error is { response?: { status?: number; data?: unknown }; message: string } {
  return (
    error instanceof Error &&
    "isAxiosError" in error &&
    (error as Record<string, unknown>).isAxiosError === true
  );
}

function isAxios404(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}
