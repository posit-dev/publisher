import { describe, it, expect, afterAll } from "vitest";
import { getClient, seedConfigFile, removeConfigFile } from "../helpers";

const client = getClient();

describe("GET /api/configurations/{name}/files", () => {
  it("returns file tree filtered by configuration", async () => {
    const res = await client.getConfigFiles("test-config");
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("files");
    expect(body.isDir).toBe(true);
  });

  it("returns 404 for non-existent configuration", async () => {
    const res = await client.getConfigFiles("nonexistent-config");
    expect(res.status).toBe("not_found");
  });
});

describe("POST /api/configurations/{name}/files", () => {
  const testName = "config-files-test";

  afterAll(() => {
    removeConfigFile(testName);
  });

  it("includes a file in the configuration", async () => {
    // Create a config to modify
    seedConfigFile(
      testName,
      `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-fastapi"
entrypoint = "fastapi-simple/app.py"
files = [
    "fastapi-simple/app.py",
    "fastapi-simple/requirements.txt",
]

[python]
version = "3.11.3"
package_manager = "pip"
`,
    );

    const res = await client.postConfigFiles(testName, {
      action: "include",
      path: "static/index.html",
    });
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.configurationName).toBe(testName);
    expect(body.configuration).toBeDefined();
    expect(body.configuration.files).toEqual(
      expect.arrayContaining(["static/index.html"]),
    );
  });

  it("excludes a file from the configuration", async () => {
    const res = await client.postConfigFiles(testName, {
      action: "exclude",
      path: "static/index.html",
    });
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.configuration.files).not.toEqual(
      expect.arrayContaining(["static/index.html"]),
    );
  });

  it("returns 404 for non-existent configuration", async () => {
    const res = await client.postConfigFiles("nonexistent-config", {
      action: "include",
      path: "foo.txt",
    });
    expect(res.status).toBe("not_found");
  });
});
