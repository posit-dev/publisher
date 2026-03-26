// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDeploymentFromFile } from "./deploymentLoader";
import { ContentRecordLoadError } from "./deploymentErrors";
import { ContentRecordState } from "../api/types/contentRecords";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-loader-test-"));
  fs.mkdirSync(path.join(tmpDir, ".posit", "publish", "deployments"), {
    recursive: true,
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeDeployment(name: string, content: string): string {
  const deploymentPath = path.join(
    tmpDir,
    ".posit",
    "publish",
    "deployments",
    `${name}.toml`,
  );
  fs.writeFileSync(deploymentPath, content, "utf-8");
  return deploymentPath;
}

const SCHEMA_URL =
  "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json";

describe("loadDeploymentFromFile", () => {
  it("loads a pre-deployment record (no deployedAt)", async () => {
    const deploymentPath = writeDeployment(
      "myapp",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
type = "python-dash"
configuration_name = "production"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.NEW);
    expect(record.serverUrl).toBe("https://connect.example.com");
    expect(record.serverType).toBe("connect");
    expect(record.createdAt).toBe("2024-01-19T09:33:33-05:00");
    expect(record.configurationName).toBe("production");
    expect(record.deploymentName).toBe("myapp");
    expect(record.deploymentPath).toBe(deploymentPath);
    expect(record.projectDir).toBe(tmpDir);
  });

  it("migrates empty created_at using file birthtime", async () => {
    const deploymentPath = writeDeployment(
      "empty-created-at",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = ""
type = "python-dash"
configuration_name = "production"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.NEW);
    // createdAt should be backfilled from file birthtime, not empty
    expect(record.createdAt).toBeDefined();
    expect(record.createdAt).not.toBe("");
    // Verify it's a valid ISO date string
    expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
  });

  it("loads a full deployment record (has deployedAt)", async () => {
    const deploymentPath = writeDeployment(
      "deployed",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
deployed_at = "2024-01-19T09:35:00-05:00"
type = "python-dash"
configuration_name = "production"
id = "abc-123"
bundle_id = "456"
bundle_url = "https://connect.example.com/__api__/v1/content/abc-123/bundles/456/download"
dashboard_url = "https://connect.example.com/connect/#/apps/abc-123"
direct_url = "https://connect.example.com/content/abc-123/"
logs_url = "https://connect.example.com/connect/#/apps/abc-123/logs"
files = ["app.py", "requirements.txt"]
requirements = ["dash==2.14.0", "pandas==2.1.0"]
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.DEPLOYED);
    if (record.state === ContentRecordState.DEPLOYED) {
      expect(record.id).toBe("abc-123");
      expect(record.bundleId).toBe("456");
      expect(record.deployedAt).toBe("2024-01-19T09:35:00-05:00");
      expect(record.dashboardUrl).toBe(
        "https://connect.example.com/connect/#/apps/abc-123",
      );
      expect(record.files).toEqual(["app.py", "requirements.txt"]);
      expect(record.requirements).toEqual(["dash==2.14.0", "pandas==2.1.0"]);
    }
  });

  it("loads a Connect Cloud pre-deployment", async () => {
    const deploymentPath = writeDeployment(
      "cloud-deploy",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.posit.cloud"
server_type = "connect_cloud"
created_at = "2024-01-19T09:33:33-05:00"
type = "python-dash"
configuration_name = "production"

[connect_cloud]
account_name = "my-account"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.NEW);
    expect(record.serverType).toBe("connect_cloud");
    expect(record.connectCloud).toEqual({ accountName: "my-account" });
  });

  it("computes logsUrl from serverUrl and id when missing", async () => {
    const deploymentPath = writeDeployment(
      "no-logs-url",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
type = "python-dash"
id = "abc-123"
configuration_name = "production"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.NEW);
    if (record.state === ContentRecordState.NEW) {
      expect(record.logsUrl).toBe(
        "https://connect.example.com/connect/#/apps/abc-123/logs",
      );
    }
  });

  it("preserves existing logsUrl when present", async () => {
    const deploymentPath = writeDeployment(
      "has-logs-url",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
type = "python-dash"
id = "abc-123"
configuration_name = "production"
logs_url = "https://custom-logs.example.com/logs"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    if (record.state === ContentRecordState.NEW) {
      expect(record.logsUrl).toBe("https://custom-logs.example.com/logs");
    }
  });

  it("throws ContentRecordLoadError for invalid TOML syntax", async () => {
    const deploymentPath = writeDeployment("bad-toml", "not valid toml [[[");

    try {
      await loadDeploymentFromFile(deploymentPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentRecordLoadError);
      if (error instanceof ContentRecordLoadError) {
        expect(error.contentRecordError.error.code).toBe("invalidTOML");
        expect(error.contentRecordError.deploymentName).toBe("bad-toml");
      }
    }
  });

  it("throws ContentRecordLoadError for schema validation failure", async () => {
    const deploymentPath = writeDeployment(
      "invalid-schema",
      'title = "Missing required fields"',
    );

    try {
      await loadDeploymentFromFile(deploymentPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentRecordLoadError);
      if (error instanceof ContentRecordLoadError) {
        expect(error.contentRecordError.error.code).toBe("tomlValidationError");
      }
    }
  });

  it("throws ENOENT for missing file (not a ContentRecordLoadError)", async () => {
    const missingPath = path.join(
      tmpDir,
      ".posit",
      "publish",
      "deployments",
      "nope.toml",
    );
    try {
      await loadDeploymentFromFile(missingPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).not.toBeInstanceOf(ContentRecordLoadError);
      expect(String(error)).toMatch(/ENOENT/);
    }
  });

  it("sets correct location metadata", async () => {
    const deploymentPath = writeDeployment(
      "location-test",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
type = "html"
configuration_name = "test"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.deploymentName).toBe("location-test");
    expect(record.deploymentPath).toBe(deploymentPath);
    expect(record.projectDir).toBe(tmpDir);
  });

  it("handles deployment_error field", async () => {
    const deploymentPath = writeDeployment(
      "with-error",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
type = "python-dash"
configuration_name = "production"

[deployment_error]
message = "deploy failed"
code = "deployFailed"
operation = "publish"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.NEW);
    expect(record.deploymentError).toEqual({
      message: "deploy failed",
      code: "deployFailed",
      operation: "publish",
    });
  });

  it("loads a record with embedded configuration", async () => {
    const deploymentPath = writeDeployment(
      "with-config",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
deployed_at = "2024-01-19T09:35:00-05:00"
type = "python-dash"
configuration_name = "production"
id = "abc-123"
bundle_id = "456"
dashboard_url = "https://connect.example.com/connect/#/apps/abc-123"
direct_url = "https://connect.example.com/content/abc-123/"
logs_url = "https://connect.example.com/connect/#/apps/abc-123/logs"
files = ["app.py"]

[configuration]
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[configuration.python]
version = "3.11.3"
package_file = "requirements.txt"
package_manager = "pip"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.DEPLOYED);
    if (record.state === ContentRecordState.DEPLOYED) {
      expect(record.configuration).toBeDefined();
      expect(record.configuration?.type).toBe("python-dash");
      expect(record.configuration?.python?.version).toBe("3.11.3");
    }
  });

  it("loads a record with renv lockfile", async () => {
    const deploymentPath = writeDeployment(
      "with-renv",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
server_type = "connect"
created_at = "2024-01-19T09:33:33-05:00"
deployed_at = "2024-01-19T09:35:00-05:00"
type = "r-shiny"
configuration_name = "production"
id = "abc-123"
bundle_id = "789"
dashboard_url = "https://connect.example.com/connect/#/apps/abc-123"
direct_url = "https://connect.example.com/content/abc-123/"
logs_url = "https://connect.example.com/connect/#/apps/abc-123/logs"
files = ["app.R"]

[renv.r]
version = "4.3.1"

[[renv.r.repositories]]
name = "CRAN"
url = "https://cloud.r-project.org"

[renv.packages.shiny]
package = "shiny"
version = "1.8.0"
source = "Repository"
repository = "CRAN"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.DEPLOYED);
    if (record.state === ContentRecordState.DEPLOYED) {
      expect(record.renv?.r?.version).toBe("4.3.1");
      expect(record.renv?.packages?.shiny?.version).toBe("1.8.0");
    }
  });

  it("loads a minimal valid record (only required fields)", async () => {
    const deploymentPath = writeDeployment(
      "minimal",
      `
"$schema" = "${SCHEMA_URL}"
server_url = "https://connect.example.com"
`,
    );

    const record = await loadDeploymentFromFile(deploymentPath, tmpDir);
    expect(record.state).toBe(ContentRecordState.NEW);
    expect(record.serverUrl).toBe("https://connect.example.com");
  });
});
