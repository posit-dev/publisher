import type { ConnectContractClient, ConnectContractResult } from "../client";

interface HarnessResponse {
  status: "success" | "error";
  result: unknown;
  error?: string;
  capturedRequests: Array<{
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
  }>;
}

export class GoPublisherClient implements ConnectContractClient {
  constructor(private apiBase: string) {}

  /**
   * Call the Go harness with a method name and params.
   * The harness clears mock requests, calls the Go method, fetches captured
   * requests, and returns everything in one response.
   */
  private async call(
    method: string,
    params: Record<string, unknown>,
  ): Promise<ConnectContractResult> {
    const res = await fetch(`${this.apiBase}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, ...params }),
    });
    const hr: HarnessResponse = await res.json();
    return {
      status: hr.status,
      result: hr.result,
      capturedRequest: hr.capturedRequests.length > 0 ? hr.capturedRequests[0] : null,
      capturedRequests: hr.capturedRequests,
    };
  }

  testAuthentication(params: { connectUrl: string; apiKey: string }) {
    return this.call("TestAuthentication", params);
  }

  getCurrentUser(params: { connectUrl: string; apiKey: string }) {
    return this.call("GetCurrentUser", params);
  }

  createDeployment(params: { connectUrl: string; apiKey: string; body: unknown }) {
    return this.call("CreateDeployment", params);
  }

  contentDetails(params: { connectUrl: string; apiKey: string; contentId: string }) {
    return this.call("ContentDetails", params);
  }

  updateDeployment(params: { connectUrl: string; apiKey: string; contentId: string; body: unknown }) {
    return this.call("UpdateDeployment", params);
  }

  getEnvVars(params: { connectUrl: string; apiKey: string; contentId: string }) {
    return this.call("GetEnvVars", params);
  }

  setEnvVars(params: { connectUrl: string; apiKey: string; contentId: string; env: Record<string, string> }) {
    return this.call("SetEnvVars", params);
  }

  async uploadBundle(params: { connectUrl: string; apiKey: string; contentId: string; bundleData: Uint8Array }) {
    const { bundleData, ...rest } = params;
    return this.call("UploadBundle", { ...rest, bundleData: Buffer.from(bundleData).toString("base64") });
  }

  deployBundle(params: { connectUrl: string; apiKey: string; contentId: string; bundleId: string }) {
    return this.call("DeployBundle", params);
  }

  waitForTask(params: { connectUrl: string; apiKey: string; taskId: string }) {
    return this.call("WaitForTask", params);
  }

  validateDeployment(params: { connectUrl: string; apiKey: string; contentId: string }) {
    return this.call("ValidateDeployment", params);
  }

  getIntegrations(params: { connectUrl: string; apiKey: string }) {
    return this.call("GetIntegrations", params);
  }

  getSettings(params: { connectUrl: string; apiKey: string }) {
    return this.call("GetSettings", params);
  }

  latestBundleId(params: { connectUrl: string; apiKey: string; contentId: string }) {
    return this.call("LatestBundleID", params);
  }

  async downloadBundle(params: { connectUrl: string; apiKey: string; contentId: string; bundleId: string }) {
    const result = await this.call("DownloadBundle", params);
    // Decode base64 result back to Uint8Array
    if (result.status === "success" && typeof result.result === "string") {
      result.result = new Uint8Array(Buffer.from(result.result, "base64"));
    }
    return result;
  }
}
