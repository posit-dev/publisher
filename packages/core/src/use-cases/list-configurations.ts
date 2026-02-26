// Copyright (C) 2026 by Posit Software, PBC.

import type { ConfigurationSummary } from "../core/types.js";
import type { ConfigurationStore } from "../core/ports.js";

/**
 * Use case: list all configurations for a project, returning partial
 * results when some config files fail to parse.
 *
 * The error-collection logic lives in each adapter's `list()` implementation.
 * This use case is a thin wrapper, preserving the extension point for
 * future domain logic like filtering or enrichment.
 */
export class ListConfigurations {
  async execute(
    store: ConfigurationStore,
    projectDir: string,
  ): Promise<ConfigurationSummary[]> {
    return store.list(projectDir);
  }
}
