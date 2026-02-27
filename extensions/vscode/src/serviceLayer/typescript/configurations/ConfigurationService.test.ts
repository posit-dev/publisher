// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { ConfigurationDetails } from "src/api/types/configurations";
import { TypeScriptConfigurationService } from "./ConfigurationService";
import { getConfigDir, writeConfig } from "./tomlConfig";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "configservice-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeService() {
  return new TypeScriptConfigurationService(tmpDir);
}

async function writeTestConfig(
  dir: string,
  name: string,
  content: Record<string, unknown>,
) {
  const configDir = getConfigDir(dir);
  await fs.mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, `${name}.toml`);
  await writeConfig(configPath, content as ConfigurationDetails);
}

describe("TypeScriptConfigurationService", () => {
  describe("getAll", () => {
    test("returns empty array when no configs exist", async () => {
      const svc = makeService();
      const result = await svc.getAll(".");
      expect(result).toEqual([]);
    });

    test("returns configs from the config directory", async () => {
      await writeTestConfig(tmpDir, "app1", {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: "connect",
        type: "python-dash",
        entrypoint: "app.py",
        title: "App 1",
        validate: true,
      });
      await writeTestConfig(tmpDir, "app2", {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: "connect",
        type: "html",
        title: "App 2",
        validate: false,
      });

      const svc = makeService();
      const result = await svc.getAll(".");
      expect(result).toHaveLength(2);

      const names = result.map((r) => r.configurationName).sort();
      expect(names).toEqual(["app1", "app2"]);
    });

    test("returns ConfigurationError for malformed TOML", async () => {
      const configDir = getConfigDir(tmpDir);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "bad.toml"),
        "this is invalid = = toml",
      );

      const svc = makeService();
      const result = await svc.getAll(".");
      expect(result).toHaveLength(1);
      expect("error" in result[0]!).toBe(true);
    });
  });

  describe("get", () => {
    test("returns a specific configuration", async () => {
      await writeTestConfig(tmpDir, "myapp", {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: "connect",
        type: "python-dash",
        entrypoint: "app.py",
        title: "My App",
        validate: true,
      });

      const svc = makeService();
      const result = await svc.get("myapp", ".");
      expect("configuration" in result).toBe(true);
      if ("configuration" in result) {
        expect(result.configuration.title).toBe("My App");
        expect(result.configuration.type).toBe("python-dash");
      }
    });

    test("returns ConfigurationError for non-existent config", async () => {
      const svc = makeService();
      const result = await svc.get("nonexistent", ".");
      expect("error" in result).toBe(true);
    });
  });

  describe("createOrUpdate", () => {
    test("creates a new config file", async () => {
      const svc = makeService();
      const config = {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: "connect",
        type: "html",
        title: "New Config",
        validate: true,
      };

      const result = await svc.createOrUpdate(
        "newconfig",
        config as unknown as ConfigurationDetails,
        ".",
      );
      expect(result.configurationName).toBe("newconfig");
      expect(result.configuration.title).toBe("New Config");

      // Verify file was written
      const configPath = path.join(getConfigDir(tmpDir), "newconfig.toml");
      const stat = await fs.stat(configPath);
      expect(stat.isFile()).toBe(true);
    });

    test("updates an existing config file", async () => {
      await writeTestConfig(tmpDir, "existing", {
        type: "html",
        title: "Original",
        validate: true,
      });

      const svc = makeService();
      const result = await svc.createOrUpdate(
        "existing",
        {
          type: "python-dash",
          title: "Updated",
          validate: false,
        } as unknown as ConfigurationDetails,
        ".",
      );
      expect(result.configuration.title).toBe("Updated");
      expect(result.configuration.type).toBe("python-dash");
    });
  });

  describe("delete", () => {
    test("deletes an existing config file", async () => {
      await writeTestConfig(tmpDir, "todelete", {
        type: "html",
        validate: true,
      });

      const svc = makeService();
      await svc.delete("todelete", ".");

      const configPath = path.join(getConfigDir(tmpDir), "todelete.toml");
      await expect(fs.access(configPath)).rejects.toThrow();
    });

    test("throws when deleting non-existent config", async () => {
      const svc = makeService();
      await expect(svc.delete("nonexistent", ".")).rejects.toThrow();
    });
  });

  describe("secrets", () => {
    test("getSecrets returns secrets array", async () => {
      await writeTestConfig(tmpDir, "withsecrets", {
        type: "html",
        validate: true,
        secrets: ["SECRET1", "SECRET2"],
      });

      const svc = makeService();
      const secrets = await svc.getSecrets("withsecrets", ".");
      expect(secrets).toEqual(["SECRET1", "SECRET2"]);
    });

    test("getSecrets returns empty array when no secrets", async () => {
      await writeTestConfig(tmpDir, "nosecrets", {
        type: "html",
        validate: true,
      });

      const svc = makeService();
      const secrets = await svc.getSecrets("nosecrets", ".");
      expect(secrets).toEqual([]);
    });

    test("addSecret adds a new secret", async () => {
      await writeTestConfig(tmpDir, "addsecret", {
        type: "html",
        validate: true,
        secrets: ["EXISTING"],
      });

      const svc = makeService();
      const result = await svc.addSecret("addsecret", "NEW_SECRET", ".");
      expect(result.configuration.secrets).toContain("EXISTING");
      expect(result.configuration.secrets).toContain("NEW_SECRET");
    });

    test("addSecret is idempotent", async () => {
      await writeTestConfig(tmpDir, "idempotent", {
        type: "html",
        validate: true,
        secrets: ["EXISTING"],
      });

      const svc = makeService();
      await svc.addSecret("idempotent", "EXISTING", ".");
      const result = await svc.addSecret("idempotent", "EXISTING", ".");
      expect(
        result.configuration.secrets!.filter((s) => s === "EXISTING"),
      ).toHaveLength(1);
    });

    test("removeSecret removes a secret", async () => {
      await writeTestConfig(tmpDir, "removesecret", {
        type: "html",
        validate: true,
        secrets: ["KEEP", "REMOVE"],
      });

      const svc = makeService();
      const result = await svc.removeSecret("removesecret", "REMOVE", ".");
      expect(result.configuration.secrets).toEqual(["KEEP"]);
    });

    test("removeSecret is safe for non-existent secrets", async () => {
      await writeTestConfig(tmpDir, "saferemove", {
        type: "html",
        validate: true,
        secrets: ["KEEP"],
      });

      const svc = makeService();
      const result = await svc.removeSecret(
        "saferemove",
        "NONEXISTENT",
        ".",
      );
      expect(result.configuration.secrets).toEqual(["KEEP"]);
    });
  });

  describe("recursive getAll", () => {
    test("finds configs in subdirectories", async () => {
      // Create config in root
      await writeTestConfig(tmpDir, "root-config", {
        type: "html",
        validate: true,
        title: "Root",
      });

      // Create config in subdirectory
      const subDir = path.join(tmpDir, "subproject");
      await writeTestConfig(subDir, "sub-config", {
        type: "python-dash",
        validate: true,
        title: "Sub",
      });

      const svc = makeService();
      const result = await svc.getAll(".", { recursive: true });
      expect(result).toHaveLength(2);

      const titles = result
        .filter((r) => "configuration" in r)
        .map(
          (r) =>
            (r as { configuration: ConfigurationDetails }).configuration.title,
        )
        .sort();
      expect(titles).toEqual(["Root", "Sub"]);
    });
  });
});
