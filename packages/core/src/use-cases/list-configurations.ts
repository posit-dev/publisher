// Copyright (C) 2026 by Posit Software, PBC.

import type { ConfigurationSummary } from "../core/types.js";
import type { ConfigurationStore } from "../core/ports.js";
import { ConfigurationReadError } from "../core/errors.js";

/**
 * Use case: list all configurations for a project, returning partial
 * results when some config files fail to parse.
 *
 * This is domain logic — not just a pass-through to the store. The
 * behavior of collecting errors alongside successes (rather than
 * failing entirely) is a deliberate design choice so the UI can show
 * broken configs with error messages.
 */
export class ListConfigurations {
  async execute(
    store: ConfigurationStore,
    projectDir: string,
  ): Promise<ConfigurationSummary[]> {
    const names = await store.list(projectDir);
    const results: ConfigurationSummary[] = [];

    for (const name of names) {
      try {
        const configuration = await store.read(projectDir, name);
        results.push({ name, projectDir, configuration });
      } catch (error) {
        if (error instanceof ConfigurationReadError) {
          results.push({ name, projectDir, error: error.message });
        } else {
          throw error;
        }
      }
    }

    return results;
  }
}
