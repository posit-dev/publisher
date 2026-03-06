// Copyright (C) 2026 by Posit Software, PBC.

import type { ConfigurationSummary } from "@publisher/core";
import type { InterpreterDefaults } from "src/api/types/interpreters";

/**
 * Fill empty interpreter fields in a ConfigurationSummary with system defaults.
 *
 * Only fills values when the section (python/r) is present but the specific
 * field is empty, which indicates the dependency exists but no version was
 * specified in the config file.
 *
 * Returns a new summary (does not mutate the input).
 */
export function applyDefaults(
  summary: ConfigurationSummary,
  defaults: InterpreterDefaults,
): ConfigurationSummary {
  if ("error" in summary) {
    return summary;
  }

  const config = structuredClone(summary.configuration);

  if (config.r !== undefined) {
    if (!config.r.version) {
      config.r.version = defaults.r.version;
    }
    if (!config.r.packageFile) {
      config.r.packageFile = defaults.r.packageFile;
    }
    if (!config.r.packageManager) {
      config.r.packageManager = defaults.r.packageManager;
    }
  }

  if (config.python !== undefined) {
    if (!config.python.version) {
      config.python.version = defaults.python.version;
    }
    if (!config.python.packageFile) {
      config.python.packageFile = defaults.python.packageFile;
    }
    if (!config.python.packageManager) {
      config.python.packageManager = defaults.python.packageManager;
    }
  }

  return { name: summary.name, projectDir: summary.projectDir, configuration: config };
}

export function applyDefaultsAll(
  summaries: ConfigurationSummary[],
  defaults: InterpreterDefaults,
): ConfigurationSummary[] {
  return summaries.map((s) => applyDefaults(s, defaults));
}
