// Copyright (C) 2026 by Posit Software, PBC.

import type { Configuration } from "./types.js";

/**
 * Enforce product type compliance on a configuration.
 *
 * Different product types (Connect vs Connect Cloud) have different
 * schema constraints. This function strips or adjusts fields that are
 * disallowed for the target product type.
 *
 * Ported from Go: `internal/config/types.go` → `Config.ForceProductTypeCompliance()`
 *
 * NOTE: The Go version also handles `EntrypointObjectRef` (resolving
 * object-reference-style entrypoints for Connect) and clearing
 * `Alternatives`. Those fields are transient — set during project
 * inspection, never persisted to TOML. They aren't part of the
 * Configuration domain type yet because the inspection use case hasn't
 * been ported. When it is, add the fields and the corresponding logic
 * here.
 *
 * Returns a new Configuration object; does not mutate the input.
 */
export function enforceProductTypeCompliance(
  config: Configuration,
): Configuration {
  const result = structuredClone(config);

  if (result.productType === "connect_cloud") {
    // Strip fields disallowed by Connect Cloud schema
    if (result.python) {
      result.python = {
        version: truncatePythonVersion(result.python.version),
      };
    }
    if (result.r) {
      result.r = {
        version: result.r.version,
      };
    }
    result.quarto = undefined;
    result.jupyter = undefined;
    result.hasParameters = undefined;
  }

  return result;
}

/**
 * Connect Cloud requires Python version in "X.Y" format (no patch).
 */
function truncatePythonVersion(version: string | undefined): string | undefined {
  if (!version) return version;
  const parts = version.split(".");
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return version;
}
