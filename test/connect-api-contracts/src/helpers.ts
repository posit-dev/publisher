// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach } from "vitest";
import type { ConnectContractClient } from "./client";
import { GoPublisherClient } from "./clients/go-publisher-client";
import { TypeScriptDirectClient } from "./clients/ts-direct-client";

export const TEST_API_KEY = "test-api-key-12345";
export const TEST_CONTENT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
export const TEST_BUNDLE_ID = "201";
export const TEST_TASK_ID = "task-abc123-def456";

let _client: ConnectContractClient | null = null;

export function getClient(): ConnectContractClient {
  if (_client) return _client;

  const clientType = process.env.__CLIENT_TYPE ?? "go";
  if (clientType === "go") {
    const apiBase = process.env.API_BASE;
    if (!apiBase) {
      throw new Error(
        "API_BASE not set. Is the global setup running correctly?",
      );
    }
    const connectUrl = getMockConnectUrl();
    _client = new GoPublisherClient(apiBase, connectUrl, TEST_API_KEY);
  } else {
    const connectUrl = getMockConnectUrl();
    _client = new TypeScriptDirectClient(connectUrl, TEST_API_KEY);
  }
  return _client;
}

export function getMockConnectUrl(): string {
  const url = process.env.MOCK_CONNECT_URL;
  if (!url) {
    throw new Error(
      "MOCK_CONNECT_URL not set. Is the global setup running correctly?",
    );
  }
  return url;
}

export async function setMockResponse(override: {
  method: string;
  pathPattern: string;
  status: number;
  body?: unknown;
  contentType?: string;
}): Promise<void> {
  const mockUrl = getMockConnectUrl();
  await fetch(`${mockUrl}/__test__/response-override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(override),
  });
}

async function clearMockOverrides(): Promise<void> {
  const mockUrl = getMockConnectUrl();
  await fetch(`${mockUrl}/__test__/response-overrides`, { method: "DELETE" });
}

export function setupContractTest() {
  const client = getClient();

  beforeEach(async () => {
    await clearMockOverrides();
  });

  return { client };
}
