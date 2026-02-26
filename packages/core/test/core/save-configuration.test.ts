// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SaveConfiguration } from "../../src/use-cases/save-configuration.js";
import { ConfigurationNotFoundError } from "../../src/core/errors.js";
import type { Configuration } from "../../src/core/types.js";
import type { ConfigurationStore } from "../../src/core/ports.js";

// --- Fakes ---

/**
 * Recording ConfigurationStore that captures what was written.
 */
class RecordingConfigurationStore implements ConfigurationStore {
  written: { projectDir: string; name: string; config: Configuration }[] = [];

  async list(): Promise<string[]> {
    return [];
  }

  async read(projectDir: string, name: string): Promise<Configuration> {
    throw new ConfigurationNotFoundError(name);
  }

  async write(
    projectDir: string,
    name: string,
    config: Configuration,
  ): Promise<void> {
    this.written.push({ projectDir, name, config });
  }

  async remove(): Promise<void> {}
}

// --- Test data ---

const projectDir = "/home/user/my-project";

// --- Tests ---

describe("SaveConfiguration", () => {
  it("writes the configuration to the store", async () => {
    const store = new RecordingConfigurationStore();
    const config: Configuration = {
      type: "python-dash",
      entrypoint: "app.py",
      python: { version: "3.11.5" },
    };

    const useCase = new SaveConfiguration();
    await useCase.execute(store, projectDir, "my-app", config);

    assert.equal(store.written.length, 1);
    assert.equal(store.written[0].name, "my-app");
    assert.equal(store.written[0].config.type, "python-dash");
  });

  it("strips Connect Cloud-disallowed fields before writing", async () => {
    const store = new RecordingConfigurationStore();
    const config: Configuration = {
      productType: "connect_cloud",
      type: "python-dash",
      entrypoint: "app.py",
      python: {
        version: "3.11.5",
        packageFile: "requirements.txt",
        packageManager: "pip",
        requiresPython: ">=3.11",
      },
      r: {
        version: "4.3.1",
        packageFile: "renv.lock",
        packageManager: "renv",
        requiresR: ">=4.3",
        packagesFromLibrary: true,
      },
      quarto: { version: "1.4.0" },
      jupyter: { hideAllInput: true },
      hasParameters: true,
    };

    const useCase = new SaveConfiguration();
    await useCase.execute(store, projectDir, "cloud-app", config);

    const written = store.written[0].config;

    // Python: only version retained, truncated to X.Y
    assert.deepStrictEqual(written.python, { version: "3.11" });

    // R: only version retained
    assert.deepStrictEqual(written.r, { version: "4.3.1" });

    // These fields are stripped entirely for Connect Cloud
    assert.equal(written.quarto, undefined);
    assert.equal(written.jupyter, undefined);
    assert.equal(written.hasParameters, undefined);
  });

  it("truncates Python version to X.Y for Connect Cloud", async () => {
    const store = new RecordingConfigurationStore();
    const config: Configuration = {
      productType: "connect_cloud",
      type: "python-fastapi",
      entrypoint: "main.py",
      python: { version: "3.12.4" },
    };

    const useCase = new SaveConfiguration();
    await useCase.execute(store, projectDir, "api", config);

    assert.equal(store.written[0].config.python?.version, "3.12");
  });

  it("does not modify configurations for regular Connect", async () => {
    const store = new RecordingConfigurationStore();
    const config: Configuration = {
      productType: "connect",
      type: "python-dash",
      entrypoint: "app.py",
      python: {
        version: "3.11.5",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
      quarto: { version: "1.4.0" },
      jupyter: { hideAllInput: true },
      hasParameters: true,
    };

    const useCase = new SaveConfiguration();
    await useCase.execute(store, projectDir, "my-app", config);

    const written = store.written[0].config;
    assert.equal(written.python?.version, "3.11.5");
    assert.equal(written.python?.packageFile, "requirements.txt");
    assert.equal(written.quarto?.version, "1.4.0");
    assert.equal(written.jupyter?.hideAllInput, true);
    assert.equal(written.hasParameters, true);
  });

  it("does not mutate the input configuration", async () => {
    const store = new RecordingConfigurationStore();
    const config: Configuration = {
      productType: "connect_cloud",
      type: "python-dash",
      entrypoint: "app.py",
      python: { version: "3.11.5", packageFile: "requirements.txt" },
      quarto: { version: "1.4.0" },
    };

    const useCase = new SaveConfiguration();
    await useCase.execute(store, projectDir, "cloud-app", config);

    // Original input should be untouched
    assert.equal(config.python?.version, "3.11.5");
    assert.equal(config.python?.packageFile, "requirements.txt");
    assert.ok(config.quarto !== undefined);
  });
});
