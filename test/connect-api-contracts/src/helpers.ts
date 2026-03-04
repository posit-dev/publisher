import { beforeEach } from "vitest";
import type { ConnectContractClient } from "./client";
import type { CapturedRequest } from "./mock-connect-server";
import { GoPublisherClient } from "./clients/go-publisher-client";
import { TypeScriptDirectClient } from "./clients/ts-direct-client";

export const TEST_API_KEY = "test-api-key-12345";

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
    _client = new TypeScriptDirectClient();
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

export async function clearMockRequests(): Promise<void> {
  const mockUrl = getMockConnectUrl();
  await fetch(`${mockUrl}/__test__/requests`, { method: "DELETE" });
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

export async function clearMockOverrides(): Promise<void> {
  const mockUrl = getMockConnectUrl();
  await fetch(`${mockUrl}/__test__/response-overrides`, { method: "DELETE" });
}

export async function getMockRequests(
  pathFilter?: string,
): Promise<CapturedRequest[]> {
  const mockUrl = getMockConnectUrl();
  const res = await fetch(`${mockUrl}/__test__/requests`);
  const requests: CapturedRequest[] = await res.json();
  if (pathFilter) {
    return requests.filter((r) => r.path.includes(pathFilter));
  }
  return requests;
}

export function setupContractTest() {
  const client = getClient();

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  return { client, apiKey: TEST_API_KEY };
}
