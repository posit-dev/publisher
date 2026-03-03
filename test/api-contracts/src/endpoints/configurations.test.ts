import { describe, it, expect, afterAll } from "vitest";
import { getClient, seedConfigFile, removeConfigFile } from "../helpers";

const client = getClient();

describe("GET /api/configurations", () => {
  it("returns configurations array with pre-seeded config", async () => {
    const res = await client.getConfigurations();
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThan(0);

    // Find our pre-seeded config
    const testConfig = body.find(
      (c: any) => c.configurationName === "test-config",
    );
    expect(testConfig).toBeDefined();
    expect(testConfig).toMatchSnapshot({
      configurationName: expect.any(String),
      configurationPath: expect.any(String),
      configurationRelPath: expect.any(String),
      projectDir: expect.any(String),
      configuration: expect.objectContaining({
        "$schema": expect.any(String),
        type: "python-fastapi",
        entrypoint: "fastapi-simple/app.py",
        files: expect.any(Array),
      }),
    });
  });

  it("returns empty array for directory with no configs", async () => {
    const res = await client.getConfigurations({ dir: "static" });
    expect(res.status).toBe("ok");
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/configurations/{name}", () => {
  it("returns a single configuration by name", async () => {
    const res = await client.getConfiguration("test-config");
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.configurationName).toBe("test-config");
    expect(body.configuration).toBeDefined();
    expect(body.configuration.type).toBe("python-fastapi");
    expect(body.configuration.entrypoint).toBe("fastapi-simple/app.py");
    expect(body).toMatchSnapshot({
      configurationName: expect.any(String),
      configurationPath: expect.any(String),
      configurationRelPath: expect.any(String),
      projectDir: expect.any(String),
      configuration: expect.objectContaining({
        "$schema": expect.any(String),
        type: expect.any(String),
        entrypoint: expect.any(String),
      }),
    });
  });

  it("returns 404 for non-existent configuration", async () => {
    const res = await client.getConfiguration("does-not-exist");
    expect(res.status).toBe("not_found");
  });
});

describe("PUT /api/configurations/{name}", () => {
  const testName = "put-test-config";

  afterAll(async () => {
    removeConfigFile(testName);
  });

  it("creates a new configuration", async () => {
    const newConfig = {
      productType: "connect",
      type: "python-fastapi",
      entrypoint: "fastapi-simple/app.py",
      files: ["fastapi-simple/app.py", "fastapi-simple/requirements.txt"],
      python: {
        version: "3.11.3",
        packageFile: "fastapi-simple/requirements.txt",
        packageManager: "pip",
      },
    };

    const res = await client.putConfiguration(testName, newConfig);
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.configurationName).toBe(testName);
    expect(body.configuration).toBeDefined();
    expect(body.configuration.type).toBe("python-fastapi");
    expect(body.configuration.entrypoint).toBe("fastapi-simple/app.py");
  });

  it("can read back the created configuration", async () => {
    const res = await client.getConfiguration(testName);
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.configurationName).toBe(testName);
    expect(body.configuration.type).toBe("python-fastapi");
  });
});

describe("DELETE /api/configurations/{name}", () => {
  const testName = "delete-test-config";

  it("deletes an existing configuration", async () => {
    // First create a config to delete
    seedConfigFile(
      testName,
      `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-fastapi"
entrypoint = "fastapi-simple/app.py"
files = ["fastapi-simple/app.py"]

[python]
version = "3.11.3"
package_manager = "pip"
`,
    );

    // Verify it exists
    const getRes = await client.getConfiguration(testName);
    expect(getRes.status).toBe("ok");

    // Delete it
    const deleteRes = await client.deleteConfiguration(testName);
    expect(deleteRes.status).toBe("no_content");

    // Verify it's gone
    const afterRes = await client.getConfiguration(testName);
    expect(afterRes.status).toBe("not_found");
  });

  it("returns 404 when deleting non-existent configuration", async () => {
    const res = await client.deleteConfiguration("does-not-exist");
    expect(res.status).toBe("not_found");
  });
});
