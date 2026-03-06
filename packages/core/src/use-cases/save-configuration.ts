// Copyright (C) 2026 by Posit Software, PBC.

import type { Configuration } from "../core/types.js";
import type { ConfigurationStore } from "../core/ports.js";
import { enforceProductTypeCompliance } from "../core/product-type-compliance.js";

/**
 * Use case: save a configuration, enforcing product type compliance
 * before writing.
 *
 * Product type compliance ensures the configuration conforms to the
 * target platform's schema (e.g. Connect Cloud disallows certain
 * fields that Connect allows). This transformation runs in the core
 * so that all callers get consistent behavior.
 */
export class SaveConfiguration {
  async execute(
    store: ConfigurationStore,
    projectDir: string,
    name: string,
    config: Configuration,
  ): Promise<void> {
    const compliant = enforceProductTypeCompliance(config);
    await store.write(projectDir, name, compliant);
  }
}
