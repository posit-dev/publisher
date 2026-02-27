// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { ConfigurationDetails } from "src/api/types/configurations";
import {
  getConfigDir,
  getConfigPath,
  listConfigFiles,
  readConfig,
  writeConfig,
  _tomlToCamel,
  _camelToToml,
} from "./tomlConfig";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tomlconfig-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("tomlConfig", () => {
  describe("getConfigDir", () => {
    test("returns .posit/publish under base", () => {
      expect(getConfigDir("/project")).toBe("/project/.posit/publish");
    });
  });

  describe("getConfigPath", () => {
    test("appends .toml extension", () => {
      expect(getConfigPath("/project", "myconfig")).toBe(
        "/project/.posit/publish/myconfig.toml",
      );
    });

    test("does not double-append .toml", () => {
      expect(getConfigPath("/project", "myconfig.toml")).toBe(
        "/project/.posit/publish/myconfig.toml",
      );
    });

    test("defaults to 'default' if name is empty", () => {
      expect(getConfigPath("/project", "")).toBe(
        "/project/.posit/publish/default.toml",
      );
    });
  });

  describe("listConfigFiles", () => {
    test("returns empty array if directory does not exist", async () => {
      const result = await listConfigFiles(
        path.join(tmpDir, "nonexistent-dir"),
      );
      expect(result).toEqual([]);
    });

    test("lists only .toml files", async () => {
      const configDir = getConfigDir(tmpDir);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(path.join(configDir, "config1.toml"), "type = 'html'");
      await fs.writeFile(
        path.join(configDir, "config2.toml"),
        "type = 'quarto'",
      );
      await fs.writeFile(
        path.join(configDir, "readme.txt"),
        "not a config file",
      );

      const result = await listConfigFiles(tmpDir);
      expect(result).toHaveLength(2);
      expect(result.map((p) => path.basename(p)).sort()).toEqual([
        "config1.toml",
        "config2.toml",
      ]);
    });
  });

  describe("key mapping", () => {
    test("tomlToCamel converts snake_case to camelCase", () => {
      const toml = {
        product_type: "connect",
        type: "html",
        python: {
          version: "3.11.0",
          package_file: "requirements.txt",
          package_manager: "pip",
        },
      };
      const result = _tomlToCamel(toml);
      expect(result).toEqual({
        productType: "connect",
        type: "html",
        python: {
          version: "3.11.0",
          packageFile: "requirements.txt",
          packageManager: "pip",
        },
      });
    });

    test("camelToToml converts camelCase to snake_case", () => {
      const camel = {
        productType: "connect",
        type: "html",
        python: {
          version: "3.11.0",
          packageFile: "requirements.txt",
          packageManager: "pip",
        },
      };
      const result = _camelToToml(camel);
      expect(result).toEqual({
        product_type: "connect",
        type: "html",
        python: {
          version: "3.11.0",
          package_file: "requirements.txt",
          package_manager: "pip",
        },
      });
    });

    test("roundtrip preserves data", () => {
      const original = {
        productType: "connect",
        type: "python-dash",
        entrypoint: "app.py",
        title: "My App",
        validate: true,
        python: {
          version: "3.11.0",
          packageFile: "requirements.txt",
          packageManager: "pip",
        },
        environment: { API_KEY: "value" },
        secrets: ["SECRET1", "SECRET2"],
        tags: ["tag1"],
      };
      const toml = _camelToToml(original);
      const back = _tomlToCamel(toml);
      expect(back).toEqual(original);
    });

    test("camelToToml skips undefined values", () => {
      const camel = {
        productType: "connect",
        type: "html",
        title: undefined,
      };
      const result = _camelToToml(camel);
      expect(result).toEqual({
        product_type: "connect",
        type: "html",
      });
    });

    test("handles arrays of objects", () => {
      const toml = {
        schedules: [
          { start: "2024-01-01", recurrence: "daily" },
          { start: "2024-06-01", recurrence: "weekly" },
        ],
      };
      const result = _tomlToCamel(toml);
      expect(result).toEqual({
        schedules: [
          { start: "2024-01-01", recurrence: "daily" },
          { start: "2024-06-01", recurrence: "weekly" },
        ],
      });
    });
  });

  describe("readConfig / writeConfig roundtrip", () => {
    test("writes and reads back a configuration", async () => {
      const configDir = getConfigDir(tmpDir);
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "test.toml");

      const config = {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: "connect",
        type: "python-dash",
        entrypoint: "app.py",
        title: "Test App",
        validate: true,
        python: {
          version: "3.11.0",
          packageFile: "requirements.txt",
          packageManager: "pip",
        },
        files: ["app.py", "requirements.txt"],
        secrets: ["API_KEY"],
      };

      await writeConfig(configPath, config as ConfigurationDetails);
      const { config: readBack } = await readConfig(configPath);

      expect(readBack.$schema).toBe(config.$schema);
      expect(readBack.productType).toBe(config.productType);
      expect(readBack.type).toBe(config.type);
      expect(readBack.entrypoint).toBe(config.entrypoint);
      expect(readBack.title).toBe(config.title);
      expect(readBack.validate).toBe(config.validate);
      expect(readBack.python).toEqual(config.python);
      expect(readBack.files).toEqual(config.files);
      expect(readBack.secrets).toEqual(config.secrets);
    });

    test("preserves leading comments", async () => {
      const configDir = getConfigDir(tmpDir);
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "commented.toml");

      const config = {
        type: "html",
        validate: true,
      };
      const comments = [
        "# This is a comment",
        "# Auto-generated configuration",
      ];

      await writeConfig(configPath, config as ConfigurationDetails, comments);
      const { config: readBack, comments: readComments } =
        await readConfig(configPath);

      expect(readComments).toEqual(comments);
      expect(readBack.type).toBe("html");
    });

    test("creates directory if it doesn't exist", async () => {
      const deepPath = path.join(tmpDir, "a", "b", "c", "config.toml");
      const config = { type: "html", validate: true };

      await writeConfig(deepPath, config as ConfigurationDetails);
      const { config: readBack } = await readConfig(deepPath);
      expect(readBack.type).toBe("html");
    });
  });

  describe("readConfig error handling", () => {
    test("throws on non-existent file", async () => {
      await expect(
        readConfig(path.join(tmpDir, "nonexistent.toml")),
      ).rejects.toThrow();
    });

    test("throws on invalid TOML", async () => {
      const configDir = getConfigDir(tmpDir);
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "bad.toml");
      await fs.writeFile(configPath, "this is not valid = = toml");

      await expect(readConfig(configPath)).rejects.toThrow();
    });
  });
});
