// Copyright (C) 2025 by Posit Software, PBC.

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { isConfigurationError } from "src/api/types/configurations";
import { FSConfigurationStore } from "./fs-configuration-store";

describe("FSConfigurationStore", () => {
  let tmpDir: string;
  let store: FSConfigurationStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "publisher-test-"));
    await fs.mkdir(path.join(tmpDir, ".posit", "publish"), { recursive: true });
    store = new FSConfigurationStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeConfig(name: string, content: string) {
    await fs.writeFile(
      path.join(tmpDir, ".posit", "publish", `${name}.toml`),
      content,
    );
  }

  test("reads a valid configuration", async () => {
    await writeConfig(
      "myconfig",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
validate = true

[python]
version = "3.11.3"
package_file = "requirements.txt"
package_manager = "pip"
`,
    );

    const result = await store.get("myconfig", ".");
    expect(isConfigurationError(result)).toBe(false);

    if (!isConfigurationError(result)) {
      expect(result.configurationName).toBe("myconfig");
      expect(result.projectDir).toBe(".");
      expect(result.configuration.type).toBe("python-dash");
      expect(result.configuration.entrypoint).toBe("app.py");
      expect(result.configuration.python?.packageFile).toBe("requirements.txt");
      expect(result.configuration.python?.packageManager).toBe("pip");
      expect(result.configuration.python?.version).toBe("3.11.3");
    }
  });

  test("reads a config with environment variables (keys preserved)", async () => {
    await writeConfig(
      "envconfig",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
validate = true

[python]
version = "3.11"

[environment]
MY_API_KEY = "https://example.com"
DATABASE_URL = "postgres://localhost"
`,
    );

    const result = await store.get("envconfig", ".");
    expect(isConfigurationError(result)).toBe(false);

    if (!isConfigurationError(result)) {
      expect(result.configuration.environment).toEqual({
        MY_API_KEY: "https://example.com",
        DATABASE_URL: "postgres://localhost",
      });
    }
  });

  test("returns ConfigurationError for invalid TOML syntax", async () => {
    await writeConfig("badtoml", "this is not [valid toml");

    const result = await store.get("badtoml", ".");
    expect(isConfigurationError(result)).toBe(true);

    if (isConfigurationError(result)) {
      expect(result.error.code).toBe("invalidTOML");
      expect(result.configurationName).toBe("badtoml");
    }
  });

  test("returns ConfigurationError for schema validation failure", async () => {
    // Missing required fields: $schema, type, entrypoint
    await writeConfig("invalid", `title = "Missing required fields"`);

    const result = await store.get("invalid", ".");
    expect(isConfigurationError(result)).toBe(true);

    if (isConfigurationError(result)) {
      expect(result.error.code).toBe("tomlValidationError");
      expect(result.configurationName).toBe("invalid");
    }
  });

  test("throws for missing file (ENOENT)", async () => {
    await expect(store.get("nonexistent", ".")).rejects.toThrow(/ENOENT/);
  });

  test("reads a config with connect runtime settings", async () => {
    await writeConfig(
      "connectconfig",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-fastapi"
entrypoint = "app:api"
validate = true

[python]
version = "3.11"

[connect.runtime]
connection_timeout = 5
read_timeout = 30
max_processes = 3
min_processes = 1
`,
    );

    const result = await store.get("connectconfig", ".");
    expect(isConfigurationError(result)).toBe(false);

    if (!isConfigurationError(result)) {
      const runtime = result.configuration.connect?.runtime;
      expect(runtime?.connectionTimeout).toBe(5);
      expect(runtime?.readTimeout).toBe(30);
      expect(runtime?.maxProcesses).toBe(3);
      expect(runtime?.minProcesses).toBe(1);
    }
  });

  test("sets correct location metadata", async () => {
    await writeConfig(
      "loctest",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
validate = true
`,
    );

    const result = await store.get("loctest", ".");
    expect(result.configurationName).toBe("loctest");
    expect(result.configurationPath).toBe(
      path.join(tmpDir, ".posit", "publish", "loctest.toml"),
    );
    expect(result.configurationRelPath).toBe(
      path.join(".posit", "publish", "loctest.toml"),
    );
    expect(result.projectDir).toBe(".");
  });
});
