// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Integration tests for the integration request workflow.
 *
 * These tests exercise the combined flow of:
 *   1. TOML config file CRUD (real filesystem)
 *   2. ConnectAPI.getIntegrations() (mocked ConnectAPI)
 *   3. The enrichment logic that merges local integration requests
 *      with server-side integration metadata (display names)
 *
 * This mirrors what homeView.refreshIntegrationRequests does at runtime.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listIntegrationRequests,
  addIntegrationRequest,
  removeIntegrationRequest,
} from "./integrationRequests";
import type { Integration } from "@posit-dev/connect-api";
import type { IntegrationRequest } from "../api/types/configurations";

// ---------------------------------------------------------------------------
// Mock @posit-dev/connect-api
//
// ConnectAPI uses its own bundled axios, so vi.mock("axios") won't intercept
// its requests. Instead we mock the entire module, giving us a controllable
// getIntegrations() that returns whatever mockGetIntegrations resolves to.
// ---------------------------------------------------------------------------

const { mockGetIntegrations, MockConnectAPI } = vi.hoisted(() => {
  const mockGetIntegrations = vi.fn();
  // Accept (and ignore) the options argument to match the real ConnectAPI constructor
  const MockConnectAPI = vi.fn(function (_opts: {
    url: string;
    apiKey: string;
  }) {
    return { getIntegrations: mockGetIntegrations };
  });
  return { mockGetIntegrations, MockConnectAPI };
});

vi.mock("@posit-dev/connect-api", () => ({
  ConnectAPI: MockConnectAPI,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "integration-requests-integration-test-"),
  );
  fs.mkdirSync(path.join(tmpDir, ".posit", "publish"), { recursive: true });
  vi.clearAllMocks();
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

/** Server-side integrations returned by Connect */
const serverIntegrations: Integration[] = [
  {
    guid: "int-aaa",
    name: "Databricks Prod",
    description: "Production Databricks workspace",
    auth_type: "oauth2",
    template: "databricks",
    config: { workspace_url: "https://databricks.example.com" },
    created_time: "2025-01-01T00:00:00Z",
  },
  {
    guid: "int-bbb",
    name: "Snowflake Analytics",
    description: "Analytics Snowflake account",
    auth_type: "oauth2",
    template: "snowflake",
    config: { account: "analytics.snowflakecomputing.com" },
    created_time: "2025-02-01T00:00:00Z",
  },
  {
    guid: "int-ccc",
    name: "GitHub Enterprise",
    description: "Internal GitHub",
    auth_type: "oauth2",
    template: "github",
    config: {},
    created_time: "2025-03-01T00:00:00Z",
  },
];

function mockServerReturns(integrations: Integration[]) {
  mockGetIntegrations.mockResolvedValue({ data: integrations });
}

function mockServerError(status: number, message: string) {
  mockGetIntegrations.mockRejectedValue(
    Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      response: { status, statusText: message, data: message },
    }),
  );
}

/**
 * Enriches local integration requests with display info from the Connect server.
 * This mirrors the logic in homeView.refreshIntegrationRequests.
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

  const connectApi = new MockConnectAPI({
    url: "https://connect.example.com",
    apiKey: "test-key",
  });
  const response: { data: Integration[] } = await connectApi.getIntegrations();
  const integrations: Integration[] = response.data ?? [];

  return integrationRequests.map((ir) => {
    const match = integrations.find(
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
// Integration tests
// ---------------------------------------------------------------------------

describe("integration: CRUD + ConnectAPI enrichment", () => {
  it("add integration request then enrich with server metadata", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]).toEqual({
      guid: "int-aaa",
      displayName: "Databricks Prod",
      displayDescription: "Production Databricks workspace",
    });
  });

  it("enriches multiple integration requests with correct server metadata", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-ccc" });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(2);
    expect(enriched[0]!.displayName).toBe("Databricks Prod");
    expect(enriched[1]!.displayName).toBe("GitHub Enterprise");
    expect(enriched[1]!.displayDescription).toBe("Internal GitHub");
  });

  it("returns undefined display fields for requests with no server match", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "orphaned-guid",
    });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.guid).toBe("orphaned-guid");
    expect(enriched[0]!.displayName).toBeUndefined();
    expect(enriched[0]!.displayDescription).toBeUndefined();
  });

  it("returns empty array when config has no integration requests", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toEqual([]);
  });

  it("handles empty server integrations list", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns([]);

    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.guid).toBe("int-aaa");
    expect(enriched[0]!.displayName).toBeUndefined();
  });
});

describe("integration: full CRUD lifecycle with enrichment", () => {
  it("add, verify, remove, verify cycle", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    // Start empty
    let enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(0);

    // Add first integration
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-bbb" });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.displayName).toBe("Snowflake Analytics");

    // Add second integration
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(2);

    // Remove first integration
    await removeIntegrationRequest("myapp", ".", tmpDir, { guid: "int-bbb" });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.guid).toBe("int-aaa");
    expect(enriched[0]!.displayName).toBe("Databricks Prod");

    // Remove second integration
    await removeIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(0);
  });

  it("duplicate add is idempotent and enrichment still works", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.displayName).toBe("Databricks Prod");
  });

  it("clear all integration requests", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    // Add three
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-bbb" });
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-ccc" });

    let enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(3);

    // Clear all (mirrors clearAllIntegrationRequests in homeView)
    const reqs = await listIntegrationRequests("myapp", ".", tmpDir);
    for (const ir of reqs) {
      await removeIntegrationRequest("myapp", ".", tmpDir, { guid: ir.guid });
    }

    enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched).toHaveLength(0);
  });
});

describe("integration: ConnectAPI error handling", () => {
  it("propagates Connect server 401 errors", async () => {
    writeConfig("myapp", baseToml);
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    mockServerError(401, "Unauthorized");

    await expect(
      enrichIntegrationRequests("myapp", ".", tmpDir),
    ).rejects.toThrow(/401/);
  });

  it("propagates Connect server 500 errors", async () => {
    writeConfig("myapp", baseToml);
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    mockServerError(500, "Internal Server Error");

    await expect(
      enrichIntegrationRequests("myapp", ".", tmpDir),
    ).rejects.toThrow(/500/);
  });
});

describe("integration: ConnectAPI instantiation", () => {
  it("creates ConnectAPI with correct url and apiKey", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns([]);

    await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(MockConnectAPI).toHaveBeenCalledWith({
      url: "https://connect.example.com",
      apiKey: "test-key",
    });
  });

  it("calls getIntegrations exactly once per enrichment", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-aaa" });
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-bbb" });

    await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(mockGetIntegrations).toHaveBeenCalledOnce();
  });
});

describe("integration: TOML round-trip preserves integration request fields", () => {
  it("preserves all fields through add/list/enrich cycle", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    await addIntegrationRequest("myapp", ".", tmpDir, {
      guid: "int-aaa",
      name: "local-name",
      description: "local-desc",
      authType: "oauth2",
      type: "databricks",
      config: { workspace_url: "https://databricks.example.com" },
    });

    // Verify TOML round-trip preserves all fields
    const reqs = await listIntegrationRequests("myapp", ".", tmpDir);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toEqual({
      guid: "int-aaa",
      name: "local-name",
      description: "local-desc",
      authType: "oauth2",
      type: "databricks",
      config: { workspace_url: "https://databricks.example.com" },
    });

    // Server display names enrich the response without replacing local fields
    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);
    expect(enriched[0]!.displayName).toBe("Databricks Prod");
    expect(enriched[0]!.displayDescription).toBe(
      "Production Databricks workspace",
    );
    // Original fields still present
    expect(enriched[0]!.name).toBe("local-name");
    expect(enriched[0]!.description).toBe("local-desc");
  });

  it("mixed matched and unmatched requests in same config", async () => {
    writeConfig("myapp", baseToml);
    mockServerReturns(serverIntegrations);

    // One matches server, one doesn't
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "int-bbb" });
    await addIntegrationRequest("myapp", ".", tmpDir, { guid: "no-match" });

    const enriched = await enrichIntegrationRequests("myapp", ".", tmpDir);

    expect(enriched).toHaveLength(2);
    // First has display info
    expect(enriched[0]!.displayName).toBe("Snowflake Analytics");
    expect(enriched[0]!.displayDescription).toBe("Analytics Snowflake account");
    // Second has undefined display info
    expect(enriched[1]!.guid).toBe("no-match");
    expect(enriched[1]!.displayName).toBeUndefined();
    expect(enriched[1]!.displayDescription).toBeUndefined();
  });
});
