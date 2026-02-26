// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ListConfigurations } from "../../src/use-cases/list-configurations.js";
import {
  ConfigurationNotFoundError,
  ConfigurationReadError,
} from "../../src/core/errors.js";
import type {
  Configuration,
  ConfigurationSummary,
} from "../../src/core/types.js";
import type { ConfigurationStore } from "../../src/core/ports.js";

// --- Fakes ---

/**
 * Fake ConfigurationStore backed by an in-memory map.
 * Allows seeding configs and injecting read errors for specific names.
 *
 * `list()` returns ConfigurationSummary[] built from seeded data,
 * including error entries for names with seeded read errors.
 */
class FakeConfigurationStore implements ConfigurationStore {
  private configs = new Map<string, Map<string, Configuration>>();
  private readErrors = new Map<string, ConfigurationReadError>();

  /** Seed a configuration into the store. */
  seed(projectDir: string, name: string, config: Configuration): void {
    if (!this.configs.has(projectDir)) {
      this.configs.set(projectDir, new Map());
    }
    this.configs.get(projectDir)!.set(name, config);
  }

  /** Make `list` include an error entry for a specific name. */
  seedReadError(name: string, error: ConfigurationReadError): void {
    this.readErrors.set(name, error);
  }

  async list(projectDir: string): Promise<ConfigurationSummary[]> {
    const results: ConfigurationSummary[] = [];

    // Add successfully parsed configs
    const projectConfigs = this.configs.get(projectDir);
    if (projectConfigs) {
      for (const [name, configuration] of projectConfigs) {
        results.push({ name, projectDir, configuration });
      }
    }

    // Add error entries for names with seeded read errors
    for (const [name, error] of this.readErrors) {
      results.push({ name, projectDir, error: error.message });
    }

    return results;
  }

  async read(projectDir: string, name: string): Promise<Configuration> {
    const readError = this.readErrors.get(name);
    if (readError) {
      throw readError;
    }

    const config = this.configs.get(projectDir)?.get(name);
    if (!config) {
      throw new ConfigurationNotFoundError(name);
    }
    return config;
  }

  async write(
    projectDir: string,
    name: string,
    config: Configuration,
  ): Promise<void> {
    if (!this.configs.has(projectDir)) {
      this.configs.set(projectDir, new Map());
    }
    this.configs.get(projectDir)!.set(name, config);
  }

  async remove(projectDir: string, name: string): Promise<void> {
    this.configs.get(projectDir)?.delete(name);
  }
}

// --- Test data ---

const projectDir = "/home/user/my-project";

const dashAppConfig: Configuration = {
  type: "python-dash",
  entrypoint: "app.py",
  python: { version: "3.11.5", packageFile: "requirements.txt" },
};

const quartoDocConfig: Configuration = {
  type: "quarto",
  entrypoint: "report.qmd",
  quarto: { version: "1.4.0" },
};

// --- Tests ---

describe("ListConfigurations", () => {
  it("returns all configurations for a project", async () => {
    const store = new FakeConfigurationStore();
    store.seed(projectDir, "dash-app", dashAppConfig);
    store.seed(projectDir, "quarto-doc", quartoDocConfig);

    const useCase = new ListConfigurations();
    const results = await useCase.execute(store, projectDir);

    assert.equal(results.length, 2);

    const dash = results.find((r) => r.name === "dash-app");
    assert.ok(dash);
    assert.ok("configuration" in dash);
    assert.equal(dash.configuration.type, "python-dash");

    const quarto = results.find((r) => r.name === "quarto-doc");
    assert.ok(quarto);
    assert.ok("configuration" in quarto);
    assert.equal(quarto.configuration.entrypoint, "report.qmd");
  });

  it("returns empty array for project with no configurations", async () => {
    const store = new FakeConfigurationStore();

    const useCase = new ListConfigurations();
    const results = await useCase.execute(store, projectDir);

    assert.deepStrictEqual(results, []);
  });

  it("includes error entries for broken config files", async () => {
    const store = new FakeConfigurationStore();
    store.seed(projectDir, "good-config", dashAppConfig);
    store.seedReadError(
      "broken-config",
      new ConfigurationReadError("broken-config", "invalid TOML at line 5"),
    );

    const useCase = new ListConfigurations();
    const results = await useCase.execute(store, projectDir);

    assert.equal(results.length, 2);

    const good = results.find((r) => r.name === "good-config");
    assert.ok(good);
    assert.ok("configuration" in good);

    const broken = results.find((r) => r.name === "broken-config");
    assert.ok(broken);
    assert.ok("error" in broken);
    assert.match(broken.error, /invalid TOML/);
  });
});
