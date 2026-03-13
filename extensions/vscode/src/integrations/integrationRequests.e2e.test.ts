// Copyright (C) 2026 by Posit Software, PBC.

/**
 * End-to-end integration tests using the MockConnectServer.
 *
 * Unlike the `.integration.test.ts` file which mocks the @posit-dev/connect-api
 * module entirely, these tests spin up the real MockConnectServer (an HTTP
 * server with canned responses) and use the real ConnectAPI client. This
 * exercises the full stack:
 *
 *   TOML CRUD → real ConnectAPI client → real HTTP requests → MockConnectServer
 *
 * This catches issues that module-level mocks cannot: incorrect URL construction,
 * missing headers, serialization bugs, and real HTTP error propagation.
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
import type { IntegrationRequest } from "../api/types/configurations";

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

/**
 * Enriches local integration requests with display info from the Connect
 * server using the real ConnectAPI client and MockConnectServer.
 */
async function enrichIntegrationRequests(
  configName: string,
  projectDir: string,
  rootDir: string,
): Promise<
  (IntegrationRequest & {
    displayName?: string;
    displayDescription?: string;
  })[]
> {
  const integrationRequests = await listIntegrationRequests(
    configName,
    projectDir,
    rootDir,
  );

  const { data: integrations } = await connectApi.getIntegrations();

  return integrationRequests.map((ir) => {
    const match = (integrations as Integration[]).find(
      (integration) => integration.guid === ir.guid,
    );
    return {
      ...ir,
      displayName: match?.name,
      displayDescription: match?.description,
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("e2e: real ConnectAPI + MockConnectServer + TOML CRUD", () => {
  it("fetches integrations from mock server default fixture", async () => {
    // The default fixture (integrations.json) has one integration
    const { data } = await connectApi.getIntegrations();
    const integrations = data as Integration[];

    expect(integrations).toBeInstanceOf(Array);
    expect(integrations.length).toBe(1);
    expect(integrations[0].guid).toBe("1a2b3c4d-5e6f-7890-abcd-ef0123456789");
    expect(integrations[0].name).toBe("My OAuth Integration");
  });

  it("sends correct HTTP method and path for getIntegrations", async () => {
    await connectApi.getIntegrations();

    const requests = await getCapturedRequests();
    expect(requests.length).toBeGreaterThanOrEqual(1);

    const integrationReq = requests.find(
      (r) => r.path === "/__api__/v1/oauth/integrations",
    );
    expect(integrationReq).toBeDefined();
    expect(integrationReq!.method).toBe("GET");
  });

  it("sends Authorization header with API key", async () => {
    await connectApi.getIntegrations();

    const requests = await getCapturedRequests();
    const integrationReq = requests.find(
      (r) => r.path === "/__api__/v1/oauth/integrations",
    );
    expect(integrationReq).toBeDefined();
    expect(integrationReq!.headers.authorization).toBe(`Key ${API_KEY}`);
  });
});

describe("e2e: CRUD + enrichment with mock server", () => {
  it("enriches integration requests using default fixture data", async () => {
    writeConfig("myapp", baseToml);

    // The default fixture has guid "1a2b3c4d-5e6f-7890-abcd-ef0123456789"
    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "1a2b3c4d-5e6f-7890-abcd-ef0123456789",
    });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.displayName).toBe("My OAuth Integration");
    expect(enriched[0]!.displayDescription).toBe(
      "OAuth integration for external service",
    );
  });

  it("returns undefined display fields when GUID has no server match", async () => {
    writeConfig("myapp", baseToml);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "no-match-guid",
    });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.guid).toBe("no-match-guid");
    expect(enriched[0]!.displayName).toBeUndefined();
    expect(enriched[0]!.displayDescription).toBeUndefined();
  });

  it("full CRUD lifecycle with real HTTP enrichment", async () => {
    writeConfig("myapp", baseToml);
    const fixtureGuid = "1a2b3c4d-5e6f-7890-abcd-ef0123456789";

    // Start empty
    let enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(0);

    // Add matching integration
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: fixtureGuid });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.displayName).toBe("My OAuth Integration");

    // Add non-matching integration
    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "orphan-guid",
    });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(2);
    expect(enriched[0]!.displayName).toBe("My OAuth Integration");
    expect(enriched[1]!.displayName).toBeUndefined();

    // Remove matching integration
    await removeIntegrationRequest("myapp", ".", tmpDir, {
      guid: fixtureGuid,
    });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.guid).toBe("orphan-guid");

    // Remove remaining
    await removeIntegrationRequest("myapp", ".", tmpDir, {
      guid: "orphan-guid",
    });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(0);
  });
});

describe("e2e: response overrides for error scenarios", () => {
  it("propagates 401 Unauthorized from mock server", async () => {
    writeConfig("myapp", baseToml);
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "any-guid" });

    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 401,
      body: { error: "Unauthorized" },
    });

    await expect(
      enrichIntegrationRequests("myapp", ".", tmpDir),
    ).rejects.toThrow(/401/);
  });

  it("propagates 500 Internal Server Error from mock server", async () => {
    writeConfig("myapp", baseToml);
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "any-guid" });

    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 500,
      body: { error: "Internal Server Error" },
    });

    await expect(
      enrichIntegrationRequests("myapp", ".", tmpDir),
    ).rejects.toThrow(/500/);
  });

  it("propagates 403 Forbidden from mock server", async () => {
    writeConfig("myapp", baseToml);
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "any-guid" });

    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 403,
      body: { error: "Forbidden" },
    });

    await expect(
      enrichIntegrationRequests("myapp", ".", tmpDir),
    ).rejects.toThrow(/403/);
  });

  it("handles empty integrations array from server override", async () => {
    writeConfig("myapp", baseToml);

    await setMockResponse({
      method: "GET",
      pathPattern: "^/__api__/v1/oauth/integrations$",
      status: 200,
      body: [],
    });

    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "some-guid" });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.displayName).toBeUndefined();
  });

  it("enriches with multiple integrations from server override", async () => {
    writeConfig("myapp", baseToml);

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

    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "custom-aaa" });
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "custom-bbb" });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(2);
    expect(enriched[0]!.displayName).toBe("Databricks Prod");
    expect(enriched[0]!.displayDescription).toBe("Production workspace");
    expect(enriched[1]!.displayName).toBe("Snowflake Dev");
    expect(enriched[1]!.displayDescription).toBe("Dev Snowflake");
  });
});

describe("e2e: request capture verification", () => {
  it("ConnectAPI sends exactly one GET request per getIntegrations call", async () => {
    writeConfig("myapp", baseToml);
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "any-guid" });

    await enrichIntegrationRequests("myapp", ".", tmpDir);

    const requests = await getCapturedRequests();
    const integrationRequests = requests.filter(
      (r) => r.path === "/__api__/v1/oauth/integrations",
    );
    expect(integrationRequests).toHaveLength(1);
    expect(integrationRequests[0].method).toBe("GET");
  });

  it("does not send request body for GET integrations", async () => {
    await connectApi.getIntegrations();

    const requests = await getCapturedRequests();
    const integrationReq = requests.find(
      (r) => r.path === "/__api__/v1/oauth/integrations",
    );
    expect(integrationReq!.body).toBeNull();
  });
});

describe("e2e: TOML round-trip with real HTTP enrichment", () => {
  it("preserves all local fields while adding server display info", async () => {
    writeConfig("myapp", baseToml);
    const fixtureGuid = "1a2b3c4d-5e6f-7890-abcd-ef0123456789";

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: fixtureGuid,
      name: "local-alias",
      description: "local-description",
      authType: "oauth2",
      type: "custom",
      config: { key: "value" },
    });

    // Verify TOML round-trip preserves all fields
    const reqs = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toEqual({
      guid: fixtureGuid,
      name: "local-alias",
      description: "local-description",
      authType: "oauth2",
      type: "custom",
      config: { key: "value" },
    });

    // Enrichment adds server display info without replacing local fields
    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched[0]!.displayName).toBe("My OAuth Integration");
    expect(enriched[0]!.displayDescription).toBe(
      "OAuth integration for external service",
    );
    expect(enriched[0]!.name).toBe("local-alias");
    expect(enriched[0]!.description).toBe("local-description");
    expect(enriched[0]!.config).toEqual({ key: "value" });
  });
});
