// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapConnectSession } from "./connectSession";
import { loadConfigFromFile } from "./toml/configLoader";
import { loadDeploymentFromFile } from "./toml/deploymentLoader";
import { collectFiles } from "./bundler/collect";
import { manifestFromConfig } from "./bundler/manifestFromConfig";
import { ContentRecordState } from "./api/types/contentRecords";

let root: string;
let publishDir: string;

const manifest = {
  version: 1,
  metadata: { appmode: "python-fastapi", entrypoint: "app:custom_app" },
  python: {
    version: "3.12.4",
    package_manager: { name: "pip", package_file: "requirements.txt" },
  },
  files: { "app.py": {}, "requirements.txt": {} },
};

async function writeManifest(value: unknown = manifest) {
  await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(value));
}

function loadConfig() {
  return loadConfigFromFile(path.join(publishDir, "connect-session.toml"), ".");
}

describe("Connect session bootstrap", () => {
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "publisher session "));
    publishDir = path.join(root, ".posit", "publish");
    vi.stubEnv("POSIT_PRODUCT", "CONNECT");
    vi.stubEnv("CONNECT_SERVER", "https://connect.example.com/team/");
    vi.stubEnv("CONNECT_API_KEY", "");
    vi.stubEnv("CONNECT_DEPLOY_TARGET_GUID", "source-guid");
    vi.stubEnv("CONNECT_CONTENT_GUID", "project-guid");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("writes schema-valid configuration and a linked, undeployed record without requiring a key", async () => {
    await writeManifest({
      ...manifest,
      title: "Old title",
      environment: { SECRET: "old-secret" },
    });
    const created = await bootstrapConnectSession(root, "2.13.16");
    expect(created?.id).toBe("source-guid");
    const config = (await loadConfig()).configuration;
    expect(config).toMatchObject({
      type: "python-fastapi",
      entrypoint: "app:custom_app",
      files: ["/app.py", "/requirements.txt"],
      python: {
        version: "3.12.4",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    });
    expect(manifestFromConfig(config).metadata.entrypoint).toBe(
      "app:custom_app",
    );
    for (const field of [
      "title",
      "description",
      "connect",
      "environment",
      "integrationRequests",
    ]) {
      expect(config).not.toHaveProperty(field);
    }
    const deployment = await loadDeploymentFromFile(
      path.join(publishDir, "deployments", "connect-session.toml"),
      ".",
    );
    expect(deployment).toMatchObject({
      id: "source-guid",
      serverUrl: process.env.CONNECT_SERVER,
      serverType: "connect",
      configurationName: "connect-session",
      state: ContentRecordState.NEW,
    });
    expect(deployment).not.toHaveProperty("deployedAt");
    expect(process.env.CONNECT_CONTENT_GUID).toBe("project-guid");
  });

  it("does not regenerate or overwrite files on later sessions", async () => {
    await writeManifest();
    await bootstrapConnectSession(root, "2.13.16");
    const configPath = path.join(publishDir, "connect-session.toml");
    const original = await fs.readFile(configPath, "utf-8");
    await fs.writeFile(configPath, original + "\n# user edit\n");
    vi.stubEnv("CONNECT_DEPLOY_TARGET_GUID", "different-guid");
    expect(await bootstrapConnectSession(root, "new-version")).toBeUndefined();
    expect(await fs.readFile(configPath, "utf-8")).toBe(
      original + "\n# user edit\n",
    );
    const deployment = await loadDeploymentFromFile(
      path.join(publishDir, "deployments", "connect-session.toml"),
      ".",
    );
    expect(deployment.id).toBe("source-guid");
  });

  it("respects any existing Publisher file, including nested files", async () => {
    await writeManifest();
    const nested = path.join(publishDir, "custom", "nested");
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(path.join(nested, "keep.txt"), "keep");
    expect(await bootstrapConnectSession(root, "version")).toBeUndefined();
    expect(await fs.readdir(publishDir)).toEqual(["custom"]);
    expect(await fs.readFile(path.join(nested, "keep.txt"), "utf-8")).toBe(
      "keep",
    );
  });

  it("allows empty Publisher directories and treats filenames as anchored literals", async () => {
    await fs.mkdir(path.join(publishDir, "deployments"), { recursive: true });
    await writeManifest({
      ...manifest,
      files: {
        "app.py": {},
        "requirements.txt": {},
        "data[1].csv": {},
        "!notes.txt": {},
      },
    });
    for (const file of [
      "app.py",
      "requirements.txt",
      "data[1].csv",
      "data1.csv",
      "!notes.txt",
    ]) {
      await fs.writeFile(path.join(root, file), "");
    }
    await fs.mkdir(path.join(root, "nested"));
    await fs.writeFile(path.join(root, "nested", "app.py"), "");
    await bootstrapConnectSession(root, "version");
    const config = (await loadConfig()).configuration;
    const files = await collectFiles(root, config.files ?? []);
    expect(
      files
        .filter((file) => !file.isDirectory)
        .map((file) => file.relativePath)
        .sort(),
    ).toEqual(
      ["app.py", "requirements.txt", "data[1].csv", "!notes.txt"].sort(),
    );
  });

  it("uses R's existing dependency scan configuration without manufacturing a lockfile", async () => {
    await writeManifest({
      metadata: { appmode: "shiny", primary_rmd: null, primary_html: null },
      platform: "4.4.2",
      files: { "app.R": {} },
      packages: { stalePackage: { description: { Version: "1.0.0" } } },
    });
    await bootstrapConnectSession(root, "version");
    expect((await loadConfig()).configuration).toMatchObject({
      type: "r-shiny",
      entrypoint: "app.R",
      r: { version: "4.4.2", packageFile: "renv.lock", packageManager: "renv" },
      files: ["/app.R"],
    });
    await expect(fs.access(path.join(root, "renv.lock"))).rejects.toMatchObject(
      { code: "ENOENT" },
    );
  });

  it("maps Quarto, R Markdown, and static HTML primary entrypoints", async () => {
    for (const { mode, primary, expectedType } of [
      { mode: "quarto-static", primary: "primary_rmd", expectedType: "quarto" },
      { mode: "rmd-static", primary: "primary_rmd", expectedType: "rmd" },
      { mode: "static", primary: "primary_html", expectedType: "html" },
    ]) {
      await writeManifest({
        metadata: { appmode: mode, [primary]: "report.html" },
        platform: "4.4.2",
        quarto: { version: "1.7.0", engines: ["knitr"] },
        files: { "report.html": {} },
      });
      await bootstrapConnectSession(root, "version");
      expect((await loadConfig()).configuration).toMatchObject({
        type: expectedType,
        entrypoint: "report.html",
        quarto: { version: "1.7.0", engines: ["knitr"] },
      });
      await fs.rm(publishDir, { recursive: true });
    }
  });

  it.each(["POSIT_PRODUCT", "CONNECT_SERVER", "CONNECT_DEPLOY_TARGET_GUID"])(
    "does nothing without %s",
    async (variable) => {
      await writeManifest();
      vi.stubEnv(variable, "");
      expect(await bootstrapConnectSession(root, "version")).toBeUndefined();
      await expect(fs.access(publishDir)).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it("does nothing without a root manifest", async () => {
    expect(await bootstrapConnectSession(root, "version")).toBeUndefined();
    await expect(fs.access(publishDir)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it.each([
    { ...manifest, metadata: { appmode: "unsupported", entrypoint: "app.py" } },
    { ...manifest, metadata: {} },
    { ...manifest, metadata: { appmode: "python-fastapi" } },
    { ...manifest, files: { "../outside.py": {} } },
    { ...manifest, files: { "..\\outside.py": {} } },
    { ...manifest, files: ["app.py"] },
    { ...manifest, python: { version: "3.12", package_manager: [] } },
    {
      ...manifest,
      python: { version: "3.12", package_manager: { package_file: 123 } },
    },
    { ...manifest, quarto: { version: "1.7.0", engines: [false] } },
    { ...manifest, quarto: { engines: ["knitr"] } },
  ])(
    "rejects unusable manifest data without creating Publisher files",
    async (invalid) => {
      await writeManifest(invalid);
      await expect(bootstrapConnectSession(root, "version")).rejects.toThrow();
      await expect(fs.access(publishDir)).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it("rejects malformed JSON and invalid server addresses without writing files", async () => {
    await fs.writeFile(path.join(root, "manifest.json"), "{broken");
    await expect(bootstrapConnectSession(root, "version")).rejects.toThrow();
    await writeManifest();
    vi.stubEnv("CONNECT_SERVER", "not a URL");
    await expect(bootstrapConnectSession(root, "version")).rejects.toThrow();
    await expect(fs.access(publishDir)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
