// Copyright (C) 2026 by Posit Software, PBC.

import type { Configuration } from "../core/types.js";
import type { ConfigurationStore } from "../core/ports.js";

/**
 * Use case: read a single configuration by name.
 *
 * Thin pass-through for now. As validation or enrichment logic moves
 * from the Go backend, it goes here.
 */
export class GetConfiguration {
  async execute(
    store: ConfigurationStore,
    projectDir: string,
    name: string,
  ): Promise<Configuration> {
    return store.read(projectDir, name);
  }
}
