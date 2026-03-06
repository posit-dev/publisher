// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getConfigDir,
  getConfigPath,
  listConfigFiles,
  loadConfiguration,
  loadAllConfigurations,
  loadAllConfigurationsRecursive,
} from "./discovery";
import { isConfigurationError } from "../api/types/configurations";
import { ConfigurationLoadError } from "./errors";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-discovery-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makePublishDir(projectDir: string): string {
  const publishDir = path.join(projectDir, ".posit", "publish");
  fs.mkdirSync(publishDir, { recursive: true });
  return publishDir;
}

function writeConfig(projectDir: string, name: string, content: string): void {
  const publishDir = makePublishDir(projectDir);
  fs.writeFileSync(path.join(publishDir, `${name}.toml`), content, "utf-8");
}

const validConfig = `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`;

const invalidConfig = "this is not valid toml [[[";

describe("getConfigDir", () => {
  it("returns the .posit/publish path", () => {
    expect(getConfigDir("/home/user/project")).toBe(
      path.join("/home/user/project", ".posit", "publish"),
    );
  });
});

describe("getConfigPath", () => {
  it("returns the full path to a named config", () => {
    expect(getConfigPath("/home/user/project", "myapp")).toBe(
      path.join("/home/user/project", ".posit", "publish", "myapp.toml"),
    );
  });
});

describe("listConfigFiles", () => {
  it("returns empty array when directory does not exist", async () => {
    const files = await listConfigFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it("returns sorted list of .toml files", async () => {
    writeConfig(tmpDir, "beta", validConfig);
    writeConfig(tmpDir, "alpha", validConfig);

    const files = await listConfigFiles(tmpDir);
    expect(files).toEqual([
      path.join(tmpDir, ".posit", "publish", "alpha.toml"),
      path.join(tmpDir, ".posit", "publish", "beta.toml"),
    ]);
  });

  it("ignores non-toml files", async () => {
    const publishDir = makePublishDir(tmpDir);
    fs.writeFileSync(path.join(publishDir, "readme.md"), "# hi", "utf-8");
    writeConfig(tmpDir, "myapp", validConfig);

    const files = await listConfigFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("myapp.toml");
  });
});

describe("loadConfiguration", () => {
  it("loads a valid config by name", async () => {
    writeConfig(tmpDir, "myapp", validConfig);

    const cfg = await loadConfiguration("myapp", ".", tmpDir);
    expect(cfg.configurationName).toBe("myapp");
    expect(cfg.configuration.type).toBe("html");
  });

  it("stores relative projectDir", async () => {
    writeConfig(tmpDir, "myapp", validConfig);

    const cfg = await loadConfiguration("myapp", ".", tmpDir);
    expect(cfg.projectDir).toBe(".");
  });

  it("stores relative projectDir for subdirectory", async () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    writeConfig(subDir, "myapp", validConfig);

    const cfg = await loadConfiguration("myapp", "sub", tmpDir);
    expect(cfg.projectDir).toBe("sub");
  });

  it("throws ConfigurationLoadError for invalid config", async () => {
    writeConfig(tmpDir, "bad", invalidConfig);

    try {
      await loadConfiguration("bad", ".", tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationLoadError);
    }
  });

  it("throws ENOENT for missing config", async () => {
    await expect(loadConfiguration("nope", ".", tmpDir)).rejects.toThrow(
      /ENOENT/,
    );
  });
});

describe("loadAllConfigurations", () => {
  it("returns empty array when no configs exist", async () => {
    const results = await loadAllConfigurations(".", tmpDir);
    expect(results).toEqual([]);
  });

  it("loads all valid configs", async () => {
    writeConfig(tmpDir, "alpha", validConfig);
    writeConfig(tmpDir, "beta", validConfig);

    const results = await loadAllConfigurations(".", tmpDir);
    expect(results).toHaveLength(2);
    expect(results.every((r) => !isConfigurationError(r))).toBe(true);
  });

  it("stores relative projectDir on loaded configs", async () => {
    writeConfig(tmpDir, "alpha", validConfig);

    const results = await loadAllConfigurations(".", tmpDir);
    expect(results).toHaveLength(1);
    expect(!isConfigurationError(results[0]!) && results[0]!.projectDir).toBe(
      ".",
    );
  });

  it("collects errors for invalid configs alongside valid ones", async () => {
    writeConfig(tmpDir, "good", validConfig);
    writeConfig(tmpDir, "bad", invalidConfig);

    const results = await loadAllConfigurations(".", tmpDir);
    expect(results).toHaveLength(2);

    const valid = results.filter((r) => !isConfigurationError(r));
    const errors = results.filter((r) => isConfigurationError(r));
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

describe("loadAllConfigurationsRecursive", () => {
  it("finds configs in the root project", async () => {
    writeConfig(tmpDir, "root-app", validConfig);

    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toHaveLength(1);
    expect(
      !isConfigurationError(results[0]!) && results[0]!.configurationName,
    ).toBe("root-app");
  });

  it("finds configs in subdirectories", async () => {
    const subDir = path.join(tmpDir, "subproject");
    fs.mkdirSync(subDir);
    writeConfig(subDir, "sub-app", validConfig);

    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toHaveLength(1);
  });

  it("stores relative projectDir for root configs as '.'", async () => {
    writeConfig(tmpDir, "root-app", validConfig);

    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toHaveLength(1);
    expect(!isConfigurationError(results[0]!) && results[0]!.projectDir).toBe(
      ".",
    );
  });

  it("stores relative projectDir for subdirectory configs", async () => {
    const subDir = path.join(tmpDir, "subproject");
    fs.mkdirSync(subDir);
    writeConfig(subDir, "sub-app", validConfig);

    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toHaveLength(1);
    expect(!isConfigurationError(results[0]!) && results[0]!.projectDir).toBe(
      "subproject",
    );
  });

  it("finds configs at multiple levels", async () => {
    writeConfig(tmpDir, "root-app", validConfig);
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    writeConfig(subDir, "sub-app", validConfig);

    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toHaveLength(2);
  });

  it("skips dot-directories", async () => {
    const dotDir = path.join(tmpDir, ".hidden");
    fs.mkdirSync(dotDir);
    writeConfig(dotDir, "hidden-app", validConfig);

    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("skips node_modules", async () => {
    const nmDir = path.join(tmpDir, "node_modules");
    fs.mkdirSync(nmDir);
    writeConfig(nmDir, "nm-app", validConfig);

    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("returns empty array for empty directory", async () => {
    const results = await loadAllConfigurationsRecursive(tmpDir);
    expect(results).toEqual([]);
  });
});
