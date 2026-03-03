import type { ConnectContractClient, ConnectContractResult } from "../client";
import type { CapturedRequest } from "../mock-connect-server";

export class GoPublisherClient implements ConnectContractClient {
  constructor(private apiBase: string) {}

  private getMockConnectUrl(): string {
    const url = process.env.MOCK_CONNECT_URL;
    if (!url) {
      throw new Error("MOCK_CONNECT_URL not set");
    }
    return url;
  }

  private async clearMockRequests(): Promise<void> {
    const mockUrl = this.getMockConnectUrl();
    await fetch(`${mockUrl}/__test__/requests`, { method: "DELETE" });
  }

  private async getCapturedRequests(
    pathFilter: string,
  ): Promise<CapturedRequest[]> {
    const mockUrl = this.getMockConnectUrl();
    const res = await fetch(`${mockUrl}/__test__/requests`);
    const requests: CapturedRequest[] = await res.json();
    return requests.filter((r) => r.path.includes(pathFilter));
  }

  async testAuthentication(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    // Clear any previously captured requests
    await this.clearMockRequests();

    // Call Publisher's POST /api/test-credentials endpoint
    const res = await fetch(`${this.apiBase}/api/test-credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: params.connectUrl,
        apiKey: params.apiKey,
        insecure: false,
        timeout: 30,
      }),
    });

    const body = await res.json();

    // Fetch the captured request that Publisher sent to mock Connect
    const captured = await this.getCapturedRequests("/__api__/v1/user");
    const capturedRequest = captured.length > 0 ? captured[0] : null;

    return {
      status: body.error ? "error" : "success",
      result: body,
      capturedRequest,
    };
  }

  async createDeployment(_params: {
    connectUrl: string;
    apiKey: string;
    body: unknown;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers CreateDeployment",
    );
  }

  async contentDetails(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers ContentDetails",
    );
  }
}
