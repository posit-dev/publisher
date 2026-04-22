// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the extension logger (depends on vscode, not needed for roundtrip tests)
vi.mock("../logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  writePublishRecord,
  lockfileToDeploymentRenv,
  type PublishRecord,
} from "./publishShared";
import { loadDeploymentFromFile } from "../toml/deploymentLoader";
import { createDeploymentRecord } from "../toml/deploymentWriter";
import {
  ContentRecordState,
  isContentRecord,
  ServerType,
} from "../api/types/contentRecords";
import { ContentType } from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";
import type { RenvLockfile } from "./rPackageDescriptions";

// Round-trip tests use the real filesystem (no mocks) to verify that records
// written by writePublishRecord() pass schema validation in loadDeploymentFromFile().

const SCHEMA_URL =
  "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "connect-publish-roundtrip-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function deploymentPath(name: string): string {
  return path.join(tmpDir, ".posit", "publish", "deployments", `${name}.toml`);
}

describe("writePublishRecord round-trip through loadDeploymentFromFile", () => {
  it("round-trips a minimal pre-deployment record", async () => {
    const record: PublishRecord = {
      schema: SCHEMA_URL,
      serverType: "connect",
      serverUrl: "https://connect.example.com",
      clientVersion: "1.0.0",
      createdAt: "2024-06-01T12:00:00.000Z",
      type: "python-shiny",
      configName: "production",
    };

    const dp = deploymentPath("minimal");
    await writePublishRecord(dp, record);

    // writePublishRecord sets deployedAt on every write, so records
    // always read back as DEPLOYED.
    // The NEW state only applies to records created via createDeploymentRecord.
    const loaded = await loadDeploymentFromFile(dp, tmpDir);
    expect(loaded.state).toBe(ContentRecordState.DEPLOYED);
    expect(loaded.serverUrl).toBe("https://connect.example.com");
    expect(loaded.serverType).toBe("connect");
    expect(loaded.type).toBe("python-shiny");
    expect(loaded.configurationName).toBe("production");
  });

  it("round-trips a fully deployed record", async () => {
    const record: PublishRecord = {
      schema: SCHEMA_URL,
      serverType: "connect",
      serverUrl: "https://connect.example.com",
      clientVersion: "1.0.0",
      createdAt: "2024-06-01T12:00:00.000Z",
      type: "python-shiny",
      configName: "production",
      id: "content-guid-123",
      dashboardUrl:
        "https://connect.example.com/connect/#/apps/content-guid-123",
      directUrl: "https://connect.example.com/content/content-guid-123/",
      logsUrl:
        "https://connect.example.com/connect/#/apps/content-guid-123/logs",
      bundleId: "bundle-42",
      bundleUrl:
        "https://connect.example.com/__api__/v1/content/content-guid-123/bundles/bundle-42/download",
      files: ["app.py", "requirements.txt"],
      requirements: ["shiny==0.6.0", "pandas==2.1.0"],
      deployedAt: "2024-06-01T12:05:00.000Z",
    };

    const dp = deploymentPath("deployed");
    await writePublishRecord(dp, record);

    const loaded = await loadDeploymentFromFile(dp, tmpDir);
    expect(loaded.state).toBe(ContentRecordState.DEPLOYED);
    if (!isContentRecord(loaded)) {
      throw new Error("expected ContentRecord");
    }
    expect(loaded.id).toBe("content-guid-123");
    expect(loaded.bundleId).toBe("bundle-42");
    expect(loaded.files).toEqual(["app.py", "requirements.txt"]);
    expect(loaded.requirements).toEqual(["shiny==0.6.0", "pandas==2.1.0"]);
  });

  it("round-trips a record with renv data", async () => {
    const renv = lockfileToDeploymentRenv({
      R: {
        Version: "4.3.1",
        Repositories: [{ Name: "CRAN", URL: "https://cloud.r-project.org" }],
      },
      Packages: {
        shiny: {
          Package: "shiny",
          Version: "1.8.0",
          Source: "Repository",
          Repository: "CRAN",
        },
        htmltools: {
          Package: "htmltools",
          Version: "0.5.7",
          Source: "Repository",
          Repository: "CRAN",
        },
      },
    });

    const record: PublishRecord = {
      schema: SCHEMA_URL,
      serverType: "connect",
      serverUrl: "https://connect.example.com",
      clientVersion: "1.0.0",
      createdAt: "2024-06-01T12:00:00.000Z",
      type: "r-shiny",
      configName: "production",
      id: "abc-123",
      dashboardUrl: "https://connect.example.com/connect/#/apps/abc-123",
      directUrl: "https://connect.example.com/content/abc-123/",
      logsUrl: "https://connect.example.com/connect/#/apps/abc-123/logs",
      bundleId: "789",
      files: ["app.R"],
      renv,
      deployedAt: "2024-06-01T12:05:00.000Z",
    };

    const dp = deploymentPath("with-renv");
    await writePublishRecord(dp, record);

    const loaded = await loadDeploymentFromFile(dp, tmpDir);
    if (!isContentRecord(loaded)) {
      throw new Error("expected ContentRecord");
    }
    expect(loaded.renv?.r?.version).toBe("4.3.1");
    expect(loaded.renv?.r?.repositories).toEqual([
      { name: "CRAN", url: "https://cloud.r-project.org" },
    ]);
    expect(loaded.renv?.packages?.shiny?.version).toBe("1.8.0");
    expect(loaded.renv?.packages?.shiny?.source).toBe("Repository");
    expect(loaded.renv?.packages?.htmltools?.version).toBe("0.5.7");
  });

  it("round-trips a record with deployment_error", async () => {
    const record: PublishRecord = {
      schema: SCHEMA_URL,
      serverType: "connect",
      serverUrl: "https://connect.example.com",
      clientVersion: "1.0.0",
      createdAt: "2024-06-01T12:00:00.000Z",
      type: "python-shiny",
      configName: "production",
      deploymentError: {
        code: "deployFailed",
        message: "Build failed: missing package numpy",
        operation: "publish",
      },
    };

    const dp = deploymentPath("with-error");
    await writePublishRecord(dp, record);

    const loaded = await loadDeploymentFromFile(dp, tmpDir);
    expect(loaded.state).toBe(ContentRecordState.DEPLOYED);
    expect(loaded.deploymentError).toEqual({
      code: "deployFailed",
      message: "Build failed: missing package numpy",
      operation: "publish",
    });
  });

  it("round-trips a record with embedded configuration", async () => {
    const record: PublishRecord = {
      schema: SCHEMA_URL,
      serverType: "connect",
      serverUrl: "https://connect.example.com",
      clientVersion: "1.0.0",
      createdAt: "2024-06-01T12:00:00.000Z",
      type: "python-shiny",
      configName: "production",
      config: {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: ProductType.CONNECT,
        type: ContentType.PYTHON_SHINY,
        entrypoint: "app.py",
        validate: false,
        python: {
          version: "3.11.3",
          packageFile: "requirements.txt",
          packageManager: "pip",
        },
      },
      files: ["app.py"],
      deployedAt: "2024-06-01T12:05:00.000Z",
    };

    const dp = deploymentPath("with-config");
    await writePublishRecord(dp, record);

    const loaded = await loadDeploymentFromFile(dp, tmpDir);
    if (!isContentRecord(loaded)) {
      throw new Error("expected ContentRecord");
    }
    expect(loaded.configuration?.type).toBe("python-shiny");
    expect(loaded.configuration?.entrypoint).toBe("app.py");
    expect(loaded.configuration?.python?.version).toBe("3.11.3");
  });
});

describe("createDeploymentRecord round-trip through loadDeploymentFromFile", () => {
  function writeConfig(name: string): void {
    const configDir = path.join(tmpDir, ".posit", "publish");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, `${name}.toml`),
      `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"\ntype = "html"\nentrypoint = "index.html"\n`,
    );
  }

  it("initial deployment record reads back as NEW", async () => {
    writeConfig("myconfig");

    const created = await createDeploymentRecord({
      saveName: "fresh-deploy",
      projectDir: ".",
      rootDir: tmpDir,
      serverUrl: "https://connect.example.com",
      serverType: ServerType.CONNECT,
      configName: "myconfig",
      clientVersion: "1.0.0",
    });

    expect(created.state).toBe(ContentRecordState.NEW);

    // Round-trip: read the file back and verify it's still NEW
    const loaded = await loadDeploymentFromFile(created.deploymentPath, tmpDir);
    expect(loaded.state).toBe(ContentRecordState.NEW);
    expect(loaded.serverUrl).toBe("https://connect.example.com");
    expect(loaded.serverType).toBe("connect");
    expect(loaded.configurationName).toBe("myconfig");
  });

  it("initial deployment with content ID reads back as NEW (no deployedAt)", async () => {
    writeConfig("myconfig");

    const created = await createDeploymentRecord({
      saveName: "with-id",
      projectDir: ".",
      rootDir: tmpDir,
      serverUrl: "https://connect.example.com",
      serverType: ServerType.CONNECT,
      configName: "myconfig",
      contentId: "abc-123",
      clientVersion: "1.0.0",
    });

    expect(created.state).toBe(ContentRecordState.NEW);

    const loaded = await loadDeploymentFromFile(created.deploymentPath, tmpDir);
    expect(loaded.state).toBe(ContentRecordState.NEW);
    expect(loaded.id).toBe("abc-123");
  });
});

describe("lockfileToDeploymentRenv — key conversion edge cases", () => {
  const EMPTY_R: RenvLockfile["R"] = {
    Version: "",
    Repositories: [],
  };

  /** Helper to extract a package entry, asserting it exists. */
  function getPkg(
    renv: Record<string, unknown>,
    name: string,
  ): Record<string, unknown> {
    const pkgs = renv.packages as Record<string, Record<string, unknown>>;
    const pkg = pkgs[name];
    if (!pkg) {
      throw new Error(`package ${name} not found`);
    }
    return pkg;
  }

  it("converts simple PascalCase keys", () => {
    const result = lockfileToDeploymentRenv({
      R: { Version: "4.3.1", Repositories: [] },
      Packages: {
        shiny: { Package: "shiny", Version: "1.8.0", Source: "Repository" },
      },
    });

    expect(result.r).toEqual({ version: "4.3.1", repositories: [] });
    const shiny = getPkg(result, "shiny");
    expect(shiny.package).toBe("shiny");
    expect(shiny.version).toBe("1.8.0");
    expect(shiny.source).toBe("Repository");
  });

  it("converts multi-capital sequences (RemotePkgRef, RemoteReposName)", () => {
    const result = lockfileToDeploymentRenv({
      R: EMPTY_R,
      Packages: {
        mypkg: {
          Package: "mypkg",
          Version: "0.1.0",
          Source: "GitHub",
          RemoteType: "github",
          RemoteHost: "api.github.com",
          RemoteRepo: "mypkg",
          RemoteUsername: "user",
          RemotePkgRef: "user/mypkg",
          RemoteRef: "HEAD",
          RemoteSha: "abc123",
          RemoteReposName: "myrepo",
        },
      },
    });

    const mypkg = getPkg(result, "mypkg");
    expect(mypkg.remote_type).toBe("github");
    expect(mypkg.remote_host).toBe("api.github.com");
    expect(mypkg.remote_pkg_ref).toBe("user/mypkg");
    expect(mypkg.remote_repos_name).toBe("myrepo");
    expect(mypkg.remote_sha).toBe("abc123");
  });

  it("converts all-caps keys like URL", () => {
    const result = lockfileToDeploymentRenv({
      R: {
        Version: "4.3.1",
        Repositories: [{ Name: "CRAN", URL: "https://cloud.r-project.org" }],
      },
      Packages: {},
    });

    const r = result.r as {
      version: string;
      repositories: Array<Record<string, string>>;
    };
    expect(r.repositories).toEqual([
      { name: "CRAN", url: "https://cloud.r-project.org" },
    ]);
  });

  it("preserves special-character keys verbatim (no conversion)", () => {
    // Keys like "Authors@R" and "Config/testthat/edition" contain
    // non-alphanumeric characters. pascalToSnake only transforms
    // uppercase letter boundaries, so these pass through as lowercase.
    const result = lockfileToDeploymentRenv({
      R: EMPTY_R,
      Packages: {
        testthat: {
          Package: "testthat",
          Version: "3.2.0",
          Source: "Repository",
          "Authors@R": 'person("Hadley")',
          "Config/testthat/edition": "3",
        },
      },
    });

    const testthat = getPkg(result, "testthat");
    // These keys have no uppercase boundaries, so they lowercase in place
    expect(testthat["authors@r"]).toBe('person("Hadley")');
    expect(testthat["config/testthat/edition"]).toBe("3");
  });

  it("omits empty, null, and undefined values", () => {
    const result = lockfileToDeploymentRenv({
      R: EMPTY_R,
      Packages: {
        shiny: {
          Package: "shiny",
          Version: "1.8.0",
          Source: "",
          Repository: undefined as unknown as string,
        },
      },
    });

    const shiny = getPkg(result, "shiny");
    expect(shiny.package).toBe("shiny");
    expect(shiny.version).toBe("1.8.0");
    expect("source" in shiny).toBe(false);
    expect("repository" in shiny).toBe(false);
  });

  it("handles empty Packages", () => {
    const result = lockfileToDeploymentRenv({
      R: EMPTY_R,
      Packages: {},
    });
    expect(result.packages).toEqual({});
  });
});
