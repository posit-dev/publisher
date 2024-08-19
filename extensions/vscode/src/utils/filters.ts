// Copyright (C) 2024 by Posit Software, PBC.

import {
  Configuration,
  ConfigurationError,
  ConfigurationInspectionResult,
  ContentType,
  isConfigurationError,
} from "../api";

export function filterInspectionResultsToType(
  inspectionResults: ConfigurationInspectionResult[],
  type: ContentType | undefined,
): ConfigurationInspectionResult[] {
  if (!type || type === ContentType.UNKNOWN) {
    return inspectionResults;
  }
  return inspectionResults.filter((cfg) => isInspectionResultOfType(cfg, type));
}

export function isInspectionResultOfType(
  inspectionResult: ConfigurationInspectionResult,
  type?: ContentType,
): boolean {
  if (type === undefined) {
    return false;
  }
  return inspectionResult.configuration.type === type;
}

export function filterConfigurationsToValidAndType(
  configs: (Configuration | ConfigurationError)[],
  type: ContentType | undefined,
): Configuration[] {
  let result = configs.filter(
    (cfg): cfg is Configuration => !isConfigurationError(cfg),
  );
  if (type && type !== ContentType.UNKNOWN) {
    result = result.filter((cfg) => isConfigurationOfType(cfg, type));
  }
  return result;
}

export function isConfigurationOfType(
  config: Configuration,
  type?: ContentType,
): boolean {
  if (type === undefined) {
    return false;
  }
  return config.configuration.type === type;
}
