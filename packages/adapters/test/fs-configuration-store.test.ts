// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import {
  ConfigurationNotFoundError,
  ConfigurationReadError,
} from "@publisher/core";
import type { Configuration } from "@publisher/core";

import { FsConfigurationStore } from "../src/fs-configuration-store.js";

// --- Test helpers ---

let tmpDir: string;

async function createTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "publisher-test-"));
}

async function writeConfigFile(
  projectDir: string,
  name: string,
  content: string,
): Promise<void> {
  const configDir = path.join(projectDir, ".posit", "publish");
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(path.join(configDir, `${name}.toml`), content, "utf-8");
}

async function readConfigFile(
  projectDir: string,
  name: string,
): Promise<string> {
  const filePath = path.join(projectDir, ".posit", "publish", `${name}.toml`);
  return fs.readFile(filePath, "utf-8");
}

// --- Test data ---

const dashAppToml = `\
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
title = "My Dashboard"
validate = true

files = [
    "app.py",
    "requirements.txt",
]

[python]
version = "3.11.5"
package_file = "requirements.txt"
package_manager = "pip"
`;

const quartoToml = `\
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "quarto"
entrypoint = "report.qmd"
`;

// --- Tests ---

describe("FsConfigurationStore", () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("list", () => {
    it("returns config names from .posit/publish/", async () => {
      await writeConfigFile(tmpDir, "dash-app", dashAppToml);
      await writeConfigFile(tmpDir, "quarto-doc", quartoToml);

      const store = new FsConfigurationStore();
      const names = await store.list(tmpDir);

      assert.deepStrictEqual(names.sort(), ["dash-app", "quarto-doc"]);
    });

    it("returns empty array when .posit/publish/ does not exist", async () => {
      const store = new FsConfigurationStore();
      const names = await store.list(tmpDir);

      assert.deepStrictEqual(names, []);
    });

    it("ignores non-TOML files", async () => {
      await writeConfigFile(tmpDir, "good", quartoToml);
      // Write a non-TOML file
      const configDir = path.join(tmpDir, ".posit", "publish");
      await fs.writeFile(
        path.join(configDir, "README.md"),
        "# Not a config",
        "utf-8",
      );

      const store = new FsConfigurationStore();
      const names = await store.list(tmpDir);

      assert.deepStrictEqual(names, ["good"]);
    });
  });

  describe("read", () => {
    it("reads and parses a TOML config file", async () => {
      await writeConfigFile(tmpDir, "dash-app", dashAppToml);

      const store = new FsConfigurationStore();
      const config = await store.read(tmpDir, "dash-app");

      assert.equal(config.type, "python-dash");
      assert.equal(config.entrypoint, "app.py");
      assert.equal(config.title, "My Dashboard");
      assert.equal(config.validate, true);
      assert.deepStrictEqual(config.files, ["app.py", "requirements.txt"]);
    });

    it("translates snake_case TOML keys to camelCase", async () => {
      await writeConfigFile(tmpDir, "dash-app", dashAppToml);

      const store = new FsConfigurationStore();
      const config = await store.read(tmpDir, "dash-app");

      assert.equal(config.python?.version, "3.11.5");
      assert.equal(config.python?.packageFile, "requirements.txt");
      assert.equal(config.python?.packageManager, "pip");
    });

    it("throws ConfigurationNotFoundError for missing files", async () => {
      const store = new FsConfigurationStore();

      await assert.rejects(
        () => store.read(tmpDir, "nonexistent"),
        (error) => {
          assert.ok(error instanceof ConfigurationNotFoundError);
          assert.match(error.message, /nonexistent/);
          return true;
        },
      );
    });

    it("throws ConfigurationReadError for invalid TOML", async () => {
      await writeConfigFile(tmpDir, "broken", "this is not valid [ toml");

      const store = new FsConfigurationStore();

      await assert.rejects(
        () => store.read(tmpDir, "broken"),
        (error) => {
          assert.ok(error instanceof ConfigurationReadError);
          assert.match(error.message, /broken/);
          assert.match(error.message, /invalid TOML/);
          return true;
        },
      );
    });
  });

  describe("write", () => {
    it("writes a configuration as TOML", async () => {
      const config: Configuration = {
        type: "python-dash",
        entrypoint: "app.py",
      };

      const store = new FsConfigurationStore();
      await store.write(tmpDir, "my-app", config);

      const content = await readConfigFile(tmpDir, "my-app");
      assert.ok(content.includes('type = "python-dash"'));
      assert.ok(content.includes('entrypoint = "app.py"'));
    });

    it("translates camelCase keys to snake_case in TOML", async () => {
      const config: Configuration = {
        type: "python-dash",
        entrypoint: "app.py",
        python: {
          version: "3.11.5",
          packageFile: "requirements.txt",
          packageManager: "pip",
        },
      };

      const store = new FsConfigurationStore();
      await store.write(tmpDir, "my-app", config);

      const content = await readConfigFile(tmpDir, "my-app");
      assert.ok(content.includes("package_file"), `Expected snake_case key "package_file" in:\n${content}`);
      assert.ok(content.includes("package_manager"), `Expected snake_case key "package_manager" in:\n${content}`);
    });

    it("creates .posit/publish/ directory if it does not exist", async () => {
      const config: Configuration = {
        type: "quarto",
        entrypoint: "doc.qmd",
      };

      const store = new FsConfigurationStore();
      await store.write(tmpDir, "doc", config);

      const content = await readConfigFile(tmpDir, "doc");
      assert.ok(content.includes('type = "quarto"'));
    });

    it("round-trips through write then read", async () => {
      const original: Configuration = {
        type: "python-dash",
        entrypoint: "app.py",
        title: "My Dashboard",
        python: {
          version: "3.11.5",
          packageFile: "requirements.txt",
        },
        files: ["app.py", "requirements.txt"],
      };

      const store = new FsConfigurationStore();
      await store.write(tmpDir, "round-trip", original);
      const read = await store.read(tmpDir, "round-trip");

      assert.equal(read.type, original.type);
      assert.equal(read.entrypoint, original.entrypoint);
      assert.equal(read.title, original.title);
      assert.equal(read.python?.version, original.python?.version);
      assert.equal(read.python?.packageFile, original.python?.packageFile);
      assert.deepStrictEqual(read.files, original.files);
    });
  });

  describe("remove", () => {
    it("deletes a configuration file", async () => {
      await writeConfigFile(tmpDir, "to-delete", quartoToml);

      const store = new FsConfigurationStore();
      await store.remove(tmpDir, "to-delete");

      const names = await store.list(tmpDir);
      assert.ok(!names.includes("to-delete"));
    });

    it("throws ConfigurationNotFoundError for missing files", async () => {
      const store = new FsConfigurationStore();

      await assert.rejects(
        () => store.remove(tmpDir, "nonexistent"),
        (error) => {
          assert.ok(error instanceof ConfigurationNotFoundError);
          return true;
        },
      );
    });
  });
});
