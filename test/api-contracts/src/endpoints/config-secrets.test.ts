import { describe, it, expect, afterAll } from "vitest";
import { getClient, seedConfigFile, removeConfigFile } from "../helpers";

const client = getClient();

describe("GET /api/configurations/{name}/secrets", () => {
  it("returns empty array for config with no secrets", async () => {
    const res = await client.getConfigSecrets("test-config");
    expect(res.status).toBe("ok");

    const body = res.body as string[];
    expect(body).toBeInstanceOf(Array);
    expect(body).toEqual([]);
  });

  it("returns 404 for non-existent configuration", async () => {
    const res = await client.getConfigSecrets("nonexistent-config");
    expect(res.status).toBe("not_found");
  });
});

describe("POST /api/configurations/{name}/secrets", () => {
  const testName = "secrets-test";

  afterAll(() => {
    removeConfigFile(testName);
  });

  it("adds a secret to the configuration", async () => {
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

    const res = await client.postConfigSecrets(testName, {
      action: "add",
      secret: "MY_SECRET",
    });
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.configurationName).toBe(testName);
    expect(body.configuration).toBeDefined();
    expect(body.configuration.secrets).toEqual(
      expect.arrayContaining(["MY_SECRET"]),
    );
  });

  it("lists the secret after adding it", async () => {
    const res = await client.getConfigSecrets(testName);
    expect(res.status).toBe("ok");

    const body = res.body as string[];
    expect(body).toEqual(["MY_SECRET"]);
  });

  it("removes a secret from the configuration", async () => {
    const res = await client.postConfigSecrets(testName, {
      action: "remove",
      secret: "MY_SECRET",
    });
    expect(res.status).toBe("ok");

    const body = res.body as any;
    // After removing all secrets, the field may be omitted (undefined) or empty
    const secrets = body.configuration.secrets;
    expect(secrets === undefined || (Array.isArray(secrets) && secrets.length === 0)).toBe(true);
  });

  it("returns 404 for non-existent configuration", async () => {
    const res = await client.postConfigSecrets("nonexistent-config", {
      action: "add",
      secret: "NOPE",
    });
    expect(res.status).toBe("not_found");
  });
});
