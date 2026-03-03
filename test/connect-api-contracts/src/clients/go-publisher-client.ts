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

  private async callHarness(
    endpoint: string,
    body: Record<string, unknown>,
    pathFilter: string,
  ): Promise<ConnectContractResult> {
    await this.clearMockRequests();

    const res = await fetch(`${this.apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const harnessResult = (await res.json()) as {
      status: string;
      result: unknown;
      error?: string;
    };

    const captured = await this.getCapturedRequests(pathFilter);
    const capturedRequest = captured.length > 0 ? captured[0] : null;

    return {
      status: harnessResult.status as "success" | "error",
      result: harnessResult.result,
      capturedRequest,
    };
  }

  async testAuthentication(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/test-authentication",
      { connectUrl: params.connectUrl, apiKey: params.apiKey },
      "/__api__/v1/user",
    );
  }

  async getCurrentUser(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/get-current-user",
      { connectUrl: params.connectUrl, apiKey: params.apiKey },
      "/__api__/v1/user",
    );
  }

  async createDeployment(params: {
    connectUrl: string;
    apiKey: string;
    body: unknown;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/create-deployment",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        body: params.body,
      },
      "/__api__/v1/content",
    );
  }

  async contentDetails(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/content-details",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
      },
      `/__api__/v1/content/${params.contentId}`,
    );
  }

  async updateDeployment(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    body: unknown;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/update-deployment",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
        body: params.body,
      },
      `/__api__/v1/content/${params.contentId}`,
    );
  }

  async getEnvVars(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/get-env-vars",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
      },
      `/__api__/v1/content/${params.contentId}/environment`,
    );
  }

  async setEnvVars(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    env: Record<string, string>;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/set-env-vars",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
        env: params.env,
      },
      `/__api__/v1/content/${params.contentId}/environment`,
    );
  }

  async uploadBundle(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleData: Uint8Array;
  }): Promise<ConnectContractResult> {
    // Encode bundle data as base64 for JSON transport
    const base64Data = Buffer.from(params.bundleData).toString("base64");
    return this.callHarness(
      "/upload-bundle",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
        bundleData: base64Data,
      },
      `/__api__/v1/content/${params.contentId}/bundles`,
    );
  }

  async deployBundle(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/deploy-bundle",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
        bundleId: params.bundleId,
      },
      `/__api__/v1/content/${params.contentId}/deploy`,
    );
  }

  async waitForTask(params: {
    connectUrl: string;
    apiKey: string;
    taskId: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/wait-for-task",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        taskId: params.taskId,
      },
      "/__api__/v1/tasks/",
    );
  }

  async validateDeployment(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/validate-deployment",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
      },
      `/content/${params.contentId}/`,
    );
  }

  async getIntegrations(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/get-integrations",
      { connectUrl: params.connectUrl, apiKey: params.apiKey },
      "/__api__/v1/oauth/integrations",
    );
  }

  async getSettings(params: {
    connectUrl: string;
    apiKey: string;
  }): Promise<ConnectContractResult> {
    // GetSettings makes 7 requests; don't filter to a single path
    await this.clearMockRequests();

    const res = await fetch(`${this.apiBase}/get-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
      }),
    });

    const harnessResult = (await res.json()) as {
      status: string;
      result: unknown;
      error?: string;
    };

    // No single capturedRequest — tests use getMockRequests() directly
    return {
      status: harnessResult.status as "success" | "error",
      result: harnessResult.result,
      capturedRequest: null,
    };
  }

  async latestBundleId(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
  }): Promise<ConnectContractResult> {
    return this.callHarness(
      "/latest-bundle-id",
      {
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
      },
      `/__api__/v1/content/${params.contentId}`,
    );
  }

  async downloadBundle(params: {
    connectUrl: string;
    apiKey: string;
    contentId: string;
    bundleId: string;
  }): Promise<ConnectContractResult> {
    await this.clearMockRequests();

    const res = await fetch(`${this.apiBase}/download-bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectUrl: params.connectUrl,
        apiKey: params.apiKey,
        contentId: params.contentId,
        bundleId: params.bundleId,
      }),
    });

    const harnessResult = (await res.json()) as {
      status: string;
      result: string; // base64 encoded
      error?: string;
    };

    const captured = await this.getCapturedRequests(
      `/__api__/v1/content/${params.contentId}/bundles/${params.bundleId}/download`,
    );
    const capturedRequest = captured.length > 0 ? captured[0] : null;

    // Decode the base64 result back to Uint8Array
    let result: unknown = harnessResult.result;
    if (
      harnessResult.status === "success" &&
      typeof harnessResult.result === "string"
    ) {
      result = new Uint8Array(
        Buffer.from(harnessResult.result, "base64"),
      );
    }

    return {
      status: harnessResult.status as "success" | "error",
      result,
      capturedRequest,
    };
  }
}
