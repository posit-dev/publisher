// Copyright (C) 2026 by Posit Software, PBC.

import { ConfigurationDetails } from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";

/**
 * Modify a config in place to ensure it complies with the JSON schema
 * for the target product type.
 *
 * Ports Go's Config.ForceProductTypeCompliance() from internal/config/types.go.
 */
export function forceProductTypeCompliance(config: ConfigurationDetails): void {
  if (config.productType === ProductType.CONNECT) {
    // Object-reference-style entrypoint is only allowed by Connect
    if (config.entrypointObjectRef) {
      config.entrypoint = config.entrypointObjectRef;
    }
  } else if (config.productType === ProductType.CONNECT_CLOUD) {
    // These fields are disallowed by the Connect Cloud schema
    if (config.python) {
      config.python.packageManager = "";
      config.python.packageFile = "";
      config.python.requiresPython = undefined;

      if (config.python.version) {
        // Connect Cloud requires Python version in "X.Y" format
        const parts = config.python.version.split(".");
        if (parts.length >= 2) {
          config.python.version = `${parts[0]}.${parts[1]}`;
        }
      }
    }
    if (config.r) {
      config.r.packageManager = "";
      config.r.packageFile = "";
      config.r.requiresR = undefined;
      config.r.packagesFromLibrary = undefined;
    }
    config.quarto = undefined;
    config.jupyter = undefined;
    config.hasParameters = undefined;
  }

  // Clear non-TOML fields so they don't interfere with schema validation
  config.entrypointObjectRef = undefined;
  config.alternatives = undefined;
}
