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
    await this.clearMockRequests();

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

    const captured = await this.getCapturedRequests("/__api__/v1/user");
    const capturedRequest = captured.length > 0 ? captured[0] : null;

    return {
      status: body.error ? "error" : "success",
      result: body,
      capturedRequest,
    };
  }

  async getCurrentUser(_params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers GetCurrentUser",
    );
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

  async updateDeployment(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    body: unknown;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers UpdateDeployment",
    );
  }

  async getEnvVars(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers GetEnvVars",
    );
  }

  async setEnvVars(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    env: Record<string, string>;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers SetEnvVars",
    );
  }

  async uploadBundle(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleData: Uint8Array;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers UploadBundle",
    );
  }

  async deployBundle(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers DeployBundle",
    );
  }

  async waitForTask(_params: {
    connectUrl: string;
    apiKey: string;
    taskId: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers WaitForTask",
    );
  }

  async validateDeployment(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers ValidateDeployment",
    );
  }

  async getIntegrations(_params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers GetIntegrations",
    );
  }

  async getSettings(_params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers GetSettings",
    );
  }

  async latestBundleId(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers LatestBundleID",
    );
  }

  async downloadBundle(_params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult> {
    throw new Error(
      "Not implemented — no standalone Publisher API endpoint triggers DownloadBundle",
    );
  }
}
