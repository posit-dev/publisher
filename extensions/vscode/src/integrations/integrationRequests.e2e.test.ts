// Copyright (C) 2026 by Posit Software, PBC.

/**
 * End-to-end tests using the MockConnectServer.
 *
 * These tests spin up a real HTTP mock server and use the real ConnectAPI
 * client alongside the TOML CRUD functions. This exercises production code
 * through real HTTP — catching issues that module-level mocks cannot:
 * incorrect URL construction, missing headers, serialization bugs, and
 * real HTTP error propagation.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { ConnectAPI } from "@posit-dev/connect-api";
import type { Integration } from "@posit-dev/connect-api";
import { MockConnectServer } from "../../../../test/connect-api-contracts/src/mock-connect-server";
import {
  listIntegrationRequests,
  addIntegrationRequest,
  removeIntegrationRequest,
} from "./integrationRequests";

// ---------------------------------------------------------------------------
// Mock Connect Server lifecycle
// ---------------------------------------------------------------------------

let mockServer: MockConnectServer;
let connectApi: ConnectAPI;
const API_KEY = "test-api-key-e2e";

beforeAll(async () => {
  mockServer = new MockConnectServer();
  await mockServer.start();
  connectApi = new ConnectAPI({ url: mockServer.url, apiKey: API_KEY });
});

afterAll(async () => {
  await mockServer.stop();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "integration-requests-e2e-test-"),
  );
  fs.mkdirSync(path.join(tmpDir, ".posit", "publish"), { recursive: true });
  // Clear any per-test response overrides and captured requests
  await fetch(`${mockServer.url}/__test__/response-overrides`, {
    method: "DELETE",
  });
  await fetch(`${mockServer.url}/__test__/requests`, { method: "DELETE" });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(name: string, content: string): void {
  const configPath = path.join(tmpDir, ".posit", "publish", `${name}.toml`);
  fs.writeFileSync(configPath, content, "utf-8");
}

const baseToml = `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[python]
version = "3.11"
`;

async function setMockResponse(override: {
  method: string;
  pathPattern: string;
  status: number;
  body?: unknown;
  contentType?: string;
}): Promise<void> {
  await fetch(`${mockServer.url}/__test__/response-override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(override),
  });
}

async function getCapturedRequests(): Promise<
  Array<{
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
  }>
> {
  const resp = await fetch(`${mockServer.url}/__test__/requests`);
  return resp.json() as Promise<
    Array<{
      method: string;
      path: string;
      headers: Record<string, string>;
      body: string | null;
    }>
  >;
}

// ---------------------------------------------------------------------------
// Tests: ConnectAPI HTTP behavior
// ---------------------------------------------------------------------------

describe("e2e: ConnectAPI getIntegrations HTTP behavior", () => {
  it("parses the integration array from the default fixture", async () => {
    const { data } = await connectApi.getIntegrations();
    const integrations = data as Integration[];

    expect(integrations).toBeInstanceOf(Array);
    expect(integrations.length).toBe(1);
    expect(integrations[0].guid).toBe("1a2b3c4d-5e6f-7890-abcd-ef0123456789");
    expect(integrations[0].name).toBe("My OAuth Integration");
  });

  it("sends GET to /__api__/v1/oauth/integrations", async () => {
    await connectApi.getIntegrations();

    const requests = await getCapturedRequests();
    const req = requests.find(
      (r) => r.path === "/__api__/v1/oauth/integrations",
    );
    expect(req).toBeDefined();
    expect(req!.method).toBe("GET");
  });

  it("sends Authorization: Key header", async () => {
    await connectApi.getIntegrations();

    const requests = await getCapturedRequests();
    const req = requests.find(
      (r) => r.path === "/__api__/v1/oauth/integrations",
    );
    expect(req).toBeDefined();
    expect(req!.headers.authorization).toBe(`Key ${API_KEY}`);
  });

  it("sends no request body", async () => {
    await connectApi.getIntegrations();

    const requests = await getCapturedRequests();
    const req = requests.find(
      (r) => r.path === "/__api__/v1/oauth/integrations",
    );
    expect(req!.body).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: ConnectAPI error propagation through real HTTP
// ---------------------------------------------------------------------------

describe("e2e: ConnectAPI error propagation", () => {
  it("throws on 401 Unauthorized", async () => {
    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 401,
      body: { error: "Unauthorized" },
    });

    await expect(connectApi.getIntegrations()).rejects.toThrow(/401/);
  });

  it("throws on 403 Forbidden", async () => {
    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 403,
      body: { error: "Forbidden" },
    });

    await expect(connectApi.getIntegrations()).rejects.toThrow(/403/);
  });

  it("throws on 500 Internal Server Error", async () => {
    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 500,
      body: { error: "Internal Server Error" },
    });

    await expect(connectApi.getIntegrations()).rejects.toThrow(/500/);
  });

  it("parses overridden multi-integration response", async () => {
    const customIntegrations = [
      {
        guid: "custom-aaa",
        name: "Databricks Prod",
        description: "Production workspace",
        auth_type: "oauth2",
        template: "databricks",
        config: {},
        created_time: "2025-01-01T00:00:00Z",
      },
      {
        guid: "custom-bbb",
        name: "Snowflake Dev",
        description: "Dev Snowflake",
        auth_type: "oauth2",
        template: "snowflake",
        config: {},
        created_time: "2025-02-01T00:00:00Z",
      },
    ];

    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 200,
      body: customIntegrations,
    });

    const { data } = await connectApi.getIntegrations();
    const integrations = data as Integration[];

    expect(integrations).toHaveLength(2);
    expect(integrations[0].name).toBe("Databricks Prod");
    expect(integrations[1].name).toBe("Snowflake Dev");
  });

  it("parses empty integrations array", async () => {
    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 200,
      body: [],
    });

    const { data } = await connectApi.getIntegrations();
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: TOML CRUD + real ConnectAPI used together
// ---------------------------------------------------------------------------

describe("e2e: CRUD lifecycle with real HTTP", () => {
  it("add, list, remove cycle with concurrent getIntegrations", async () => {
    writeConfig("myapp", baseToml);

    // Start empty
    let reqs = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(reqs).toHaveLength(0);

    // Add an integration request matching the fixture GUID
    const fixtureGuid = "1a2b3c4d-5e6f-7890-abcd-ef0123456789";
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: fixtureGuid });

    // CRUD and ConnectAPI both work in the same test context
    reqs = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]!.guid).toBe(fixtureGuid);

    const { data } = await connectApi.getIntegrations();
    const integrations = data as Integration[];
    expect(integrations[0].guid).toBe(fixtureGuid);

    // Remove and verify
    await removeIntegrationRequest("myapp", ".", tmpDir, {
      guid: fixtureGuid,
    });
    reqs = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(reqs).toHaveLength(0);
  });

  it("TOML round-trip preserves all integration request fields", async () => {
    writeConfig("myapp", baseToml);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "1a2b3c4d-5e6f-7890-abcd-ef0123456789",
      name: "local-alias",
      description: "local-description",
      authType: "oauth2",
      type: "custom",
      config: { key: "value" },
    });

    const reqs = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toEqual({
      guid: "1a2b3c4d-5e6f-7890-abcd-ef0123456789",
      name: "local-alias",
      description: "local-description",
      authType: "oauth2",
      type: "custom",
      config: { key: "value" },
    });
  });
});
