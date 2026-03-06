import { describe, it, expect, afterAll } from "vitest";
import { getClient, seedConfigFile, removeConfigFile } from "../helpers";

const client = getClient();

describe("Integration Requests", () => {
  const testName = "integration-req-test";

  afterAll(() => {
    removeConfigFile(testName);
  });

  it("GET returns null/empty initially", async () => {
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

    const res = await client.getIntegrationRequests(testName);
    expect(res.status).toBe("ok");
    // Initially no integration requests — should be null or empty array
    const body = res.body;
    expect(body == null || (Array.isArray(body) && body.length === 0)).toBe(
      true,
    );
  });

  it("POST adds an integration request", async () => {
    const integrationRequest = {
      guid: "test-integration-guid",
      name: "snowflake-connection",
      description: "Test Snowflake connection",
      auth_type: "oauth2",
      type: "snowflake",
      config: { account: "test-account" },
    };

    const res = await client.postIntegrationRequest(
      testName,
      integrationRequest,
    );
    expect(res.status).toBe("created");

    const body = res.body as any;
    expect(body.configurationName).toBe(testName);
    expect(body.configuration).toBeDefined();
  });

  it("GET returns the added integration request", async () => {
    const res = await client.getIntegrationRequests(testName);
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThan(0);

    const found = body.find(
      (ir: any) => ir.guid === "test-integration-guid",
    );
    expect(found).toBeDefined();
    expect(found.name).toBe("snowflake-connection");
  });

  it("DELETE removes the integration request", async () => {
    const res = await client.deleteIntegrationRequest(testName, {
      guid: "test-integration-guid",
      name: "snowflake-connection",
      description: "Test Snowflake connection",
      auth_type: "oauth2",
      type: "snowflake",
      config: { account: "test-account" },
    });
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.configurationName).toBe(testName);
  });

  it("GET returns empty after deletion", async () => {
    const res = await client.getIntegrationRequests(testName);
    expect(res.status).toBe("ok");

    const body = res.body;
    expect(body == null || (Array.isArray(body) && body.length === 0)).toBe(
      true,
    );
  });

  it("GET returns 404 for non-existent configuration", async () => {
    const res = await client.getIntegrationRequests("nonexistent-config");
    expect(res.status).toBe("not_found");
  });
});
