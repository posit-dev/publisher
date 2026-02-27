// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Transform ConfigurationSummary (core domain) → Go API types for the
 * webview boundary. The webview (Vue app) still consumes Go API types;
 * this module keeps that translation in one place.
 */

import type { ConfigurationSummary, Configuration as CoreConfiguration } from "@publisher/core";
import type {
  Configuration as ApiConfiguration,
  ConfigurationError as ApiConfigurationError,
  ConfigurationDetails,
  ContentType as ApiContentType,
} from "src/api/types/configurations";
import type { ProductType as ApiProductType } from "src/api/types/contentRecords";
import { configurationPath } from "./configPath";

function configurationRelPath(name: string): string {
  return `.posit/publish/${name}.toml`;
}

function toConfigurationDetails(config: CoreConfiguration): ConfigurationDetails {
  return {
    $schema: config["$schema"] ?? "",
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
    schedules: config.schedules?.map((s) => ({
      start: s.start ?? "",
      recurrence: s.recurrence ?? "",
    })),
    connect: config.connect,
    integrationRequests:
      config.integrationRequests as ConfigurationDetails["integrationRequests"],
  };
}

/**
 * Convert a success-variant ConfigurationSummary to a Go API Configuration.
 */
export function toApiValidConfig(
  summary: ConfigurationSummary & { configuration: CoreConfiguration },
): ApiConfiguration {
  return {
    configurationName: summary.name,
    configurationPath: configurationPath(summary.projectDir, summary.name),
    configurationRelPath: configurationRelPath(summary.name),
    projectDir: summary.projectDir,
    configuration: toConfigurationDetails(summary.configuration),
  };
}

/**
 * Convert an error-variant ConfigurationSummary to a Go API ConfigurationError.
 */
export function toApiConfigError(
  summary: ConfigurationSummary & { error: string },
): ApiConfigurationError {
  return {
    configurationName: summary.name,
    configurationPath: configurationPath(summary.projectDir, summary.name),
    configurationRelPath: configurationRelPath(summary.name),
    projectDir: summary.projectDir,
    error: { code: "unknown", msg: summary.error, operation: "" },
  };
}

/**
 * Convert a ConfigurationSummary to the appropriate Go API type.
 */
export function toApiConfiguration(
  summary: ConfigurationSummary,
): ApiConfiguration | ApiConfigurationError {
  if ("error" in summary) {
    return toApiConfigError(summary);
  }
  return toApiValidConfig(summary);
}

/**
 * Convert success-variant summaries to Go API Configuration[].
 */
export function toApiValidConfigs(
  summaries: ConfigurationSummary[],
): ApiConfiguration[] {
  return summaries
    .filter((s): s is ConfigurationSummary & { configuration: CoreConfiguration } =>
      "configuration" in s,
    )
    .map(toApiValidConfig);
}

/**
 * Convert error-variant summaries to Go API ConfigurationError[].
 */
export function toApiConfigsInError(
  summaries: ConfigurationSummary[],
): ApiConfigurationError[] {
  return summaries
    .filter((s): s is ConfigurationSummary & { error: string } => "error" in s)
    .map(toApiConfigError);
}

/**
 * Convert a Go API Configuration to a ConfigurationSummary.
 *
 * Used at the boundary where multi-step inputs return Go API types that
 * need to be stored as domain types in PublisherState.
 */
export function fromApiToSummary(apiConfig: ApiConfiguration): ConfigurationSummary {
  const d = apiConfig.configuration;
  return {
    name: apiConfig.configurationName,
    projectDir: apiConfig.projectDir,
    configuration: {
      "$schema": d.$schema || undefined,
      productType: d.productType as CoreConfiguration["productType"],
      type: d.type as CoreConfiguration["type"],
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
    },
  };
}
