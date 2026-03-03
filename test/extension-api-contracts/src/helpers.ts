import type { ExtensionContractClient } from "./client";
import type { CapturedRequest } from "./mock-publisher-server";
import { AxiosExtensionClient } from "./clients/axios-extension-client";
import { FetchReferenceClient } from "./clients/fetch-reference-client";

let _client: ExtensionContractClient | null = null;

export function getClient(): ExtensionContractClient {
  if (_client) return _client;

  const clientType = process.env.__CLIENT_TYPE ?? "axios";
  if (clientType === "axios") {
    const mockUrl = getMockPublisherUrl();
    _client = new AxiosExtensionClient(mockUrl);
  } else {
    _client = new FetchReferenceClient();
  }
  return _client;
}

export function getMockPublisherUrl(): string {
  const url = process.env.MOCK_PUBLISHER_URL;
  if (!url) {
    throw new Error(
      "MOCK_PUBLISHER_URL not set. Is the global setup running correctly?",
    );
  }
  return url;
}

export async function clearMockRequests(): Promise<void> {
  const mockUrl = getMockPublisherUrl();
  await fetch(`${mockUrl}/__test__/requests`, { method: "DELETE" });
}

export async function getMockRequests(
  pathFilter?: string,
): Promise<CapturedRequest[]> {
  const mockUrl = getMockPublisherUrl();
  const res = await fetch(`${mockUrl}/__test__/requests`);
  const requests: CapturedRequest[] = await res.json();
  if (pathFilter) {
    return requests.filter((r) => r.path.includes(pathFilter));
  }
  return requests;
}
