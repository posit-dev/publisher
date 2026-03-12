// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDeploymentDir,
  getDeploymentPath,
  listDeploymentFiles,
  loadDeployment,
  loadAllDeployments,
  loadAllDeploymentsRecursive,
} from "./deploymentDiscovery";
import {
  ContentRecordState,
  isContentRecordError,
} from "../api/types/contentRecords";

const SCHEMA_URL =
  "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-discovery-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeProjectDir(relDir: string = "."): string {
  const absDir = path.resolve(tmpDir, relDir);
  fs.mkdirSync(path.join(absDir, ".posit", "publish", "deployments"), {
    recursive: true,
  });
  return absDir;
}

function writeDeployment(
  absDir: string,
  name: string,
  content: string,
): string {
  const filePath = path.join(
    absDir,
    ".posit",
    "publish",
    "deployments",
    `${name}.toml`,
  );
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

const validDeployment = `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
type = "html"
configuration_name = "test"
`;

describe("getDeploymentDir", () => {
  it("returns the standard deployments directory path", () => {
    expect(getDeploymentDir("/project")).toBe(
      path.join("/project", ".posit", "publish", "deployments"),
    );
  });
});

describe("getDeploymentPath", () => {
  it("returns the full path for a named deployment", () => {
    expect(getDeploymentPath("/project", "myapp")).toBe(
      path.join("/project", ".posit", "publish", "deployments", "myapp.toml"),
    );
  });
});

describe("listDeploymentFiles", () => {
  it("lists .toml files sorted alphabetically", async () => {
    const dir = makeProjectDir();
    writeDeployment(dir, "beta", validDeployment);
    writeDeployment(dir, "alpha", validDeployment);

    const files = await listDeploymentFiles(dir);
    expect(files).toHaveLength(2);
    expect(path.basename(files[0]!)).toBe("alpha.toml");
    expect(path.basename(files[1]!)).toBe("beta.toml");
  });

  it("returns empty array when directory doesn't exist", async () => {
    const files = await listDeploymentFiles("/nonexistent");
    expect(files).toEqual([]);
  });

  it("returns empty array when no .toml files", async () => {
    const dir = makeProjectDir();
    const files = await listDeploymentFiles(dir);
    expect(files).toEqual([]);
  });
});

describe("loadDeployment", () => {
  it("loads a single deployment by name", async () => {
    const dir = makeProjectDir();
    writeDeployment(dir, "myapp", validDeployment);

    const record = await loadDeployment("myapp", ".", tmpDir);
    expect(record.state).toBe(ContentRecordState.NEW);
    expect(record.deploymentName).toBe("myapp");
    expect(record.serverUrl).toBe("https://connect.example.com");
  });

  it("throws for missing deployment", async () => {
    makeProjectDir();
    await expect(loadDeployment("nonexistent", ".", tmpDir)).rejects.toThrow(
      /ENOENT/,
    );
  });
});

describe("loadAllDeployments", () => {
  it("loads all deployments from a project directory", async () => {
    const dir = makeProjectDir();
    writeDeployment(dir, "app1", validDeployment);
    writeDeployment(dir, "app2", validDeployment);

    const records = await loadAllDeployments(".", tmpDir);
    expect(records).toHaveLength(2);
    expect(records.every((r) => !isContentRecordError(r))).toBe(true);
  });

  it("returns errors for invalid deployments alongside valid ones", async () => {
    const dir = makeProjectDir();
    writeDeployment(dir, "good", validDeployment);
    writeDeployment(dir, "bad", "not valid toml [[[");

    const records = await loadAllDeployments(".", tmpDir);
    expect(records).toHaveLength(2);

    const errors = records.filter(isContentRecordError);
    const valid = records.filter((r) => !isContentRecordError(r));
    expect(errors).toHaveLength(1);
    expect(valid).toHaveLength(1);
    expect(errors[0]!.deploymentName).toBe("bad");
  });

  it("returns empty array when no deployments exist", async () => {
    makeProjectDir();
    const records = await loadAllDeployments(".", tmpDir);
    expect(records).toEqual([]);
  });
});

describe("loadAllDeploymentsRecursive", () => {
  it("finds deployments in nested project directories", async () => {
    const rootDir = makeProjectDir();
    writeDeployment(rootDir, "root-app", validDeployment);

    const subDir = makeProjectDir("subproject");
    writeDeployment(subDir, "sub-app", validDeployment);

    const records = await loadAllDeploymentsRecursive(tmpDir, tmpDir);
    expect(records).toHaveLength(2);

    const names = records
      .filter((r) => !isContentRecordError(r))
      .map((r) => r.deploymentName)
      .sort();
    expect(names).toEqual(["root-app", "sub-app"]);
  });

  it("skips dot-directories (except .posit)", async () => {
    makeProjectDir();

    // Create a .hidden directory with a .posit/publish/deployments inside
    const hiddenDir = path.join(tmpDir, ".hidden");
    fs.mkdirSync(path.join(hiddenDir, ".posit", "publish", "deployments"), {
      recursive: true,
    });
    writeDeployment(hiddenDir, "hidden-app", validDeployment);

    const records = await loadAllDeploymentsRecursive(tmpDir, tmpDir);
    expect(records).toHaveLength(0);
  });

  it("skips node_modules", async () => {
    makeProjectDir();

    const nmDir = path.join(tmpDir, "node_modules", "some-package");
    fs.mkdirSync(path.join(nmDir, ".posit", "publish", "deployments"), {
      recursive: true,
    });
    writeDeployment(nmDir, "nm-app", validDeployment);

    const records = await loadAllDeploymentsRecursive(tmpDir, tmpDir);
    expect(records).toEqual([]);
  });

  it("returns empty array when no .posit directories found", async () => {
    fs.mkdirSync(path.join(tmpDir, "some-dir"), { recursive: true });
    const records = await loadAllDeploymentsRecursive(tmpDir, tmpDir);
    expect(records).toEqual([]);
  });
});
