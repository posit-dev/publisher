// Copyright (C) 2024 by Posit Software, PBC.

import {
  Configuration,
  ConfigurationError,
  ContentType,
  isConfigurationError,
} from "../api";

export function filterConfigurationsToValidAndType(
  configs: (Configuration | ConfigurationError)[],
  type: ContentType | undefined,
): Configuration[] {
  const result: Configuration[] = [];
  configs.forEach((config) => {
    if (
      !isConfigurationError(config) &&
      (!type || config.configuration.type === type)
    ) {
      result.push(config);
    }
  });
  return result;
}
