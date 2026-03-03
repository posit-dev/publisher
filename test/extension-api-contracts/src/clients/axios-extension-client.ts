import axios, { AxiosError, type AxiosInstance } from "axios";
import type {
  ExtensionContractClient,
  ExtensionContractResult,
  ExtensionContractStatus,
} from "../client";
import type { CapturedRequest } from "../mock-publisher-server";

function mapStatus(httpStatus: number): ExtensionContractStatus {
  switch (httpStatus) {
    case 200:
    case 201:
    case 204:
      return "success";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    default:
      return "error";
  }
}

export class AxiosExtensionClient implements ExtensionContractClient {
  private client: AxiosInstance;
  private mockUrl: string;

  constructor(mockUrl: string) {
    this.mockUrl = mockUrl;
    this.client = axios.create({
      baseURL: mockUrl,
      // Match extension behavior: don't throw on non-2xx
      validateStatus: () => true,
    });
  }

  private async getCapturedRequests(
    pathFilter?: string,
  ): Promise<CapturedRequest[]> {
    const res = await fetch(`${this.mockUrl}/__test__/requests`);
    const requests: CapturedRequest[] = await res.json();
    if (pathFilter) {
      return requests.filter((r) => r.path.includes(pathFilter));
    }
    return requests;
  }

  private async wrapCall<T>(
    fn: () => Promise<{ status: number; data: T }>,
    pathFilter?: string,
  ): Promise<ExtensionContractResult<T>> {
    try {
      const response = await fn();
      const captured = pathFilter
        ? await this.getCapturedRequests(pathFilter)
        : [];
      return {
        status: mapStatus(response.status),
        result: response.data,
        capturedRequests: captured,
      };
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const captured = pathFilter
          ? await this.getCapturedRequests(pathFilter)
          : [];
        return {
          status: mapStatus(err.response.status),
          result: err.response.data as T,
          capturedRequests: captured,
        };
      }
      throw err;
    }
  }

  // --- Configurations ---

  // Mirrors: Configurations.getAll(dir) → GET /configurations?dir=...
  // Note: The real extension uses `/configurations` (leading slash), which with
  // Axios resolves relative to the origin, bypassing any path in baseURL.
  async getConfigurations(dir: string): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () =>
        this.client.get("/configurations", {
          params: { dir },
        }),
      "/configurations",
    );
  }

  // Mirrors: Configurations.get(configName, dir) → GET /configurations/:name?dir=...
  async getConfiguration(
    name: string,
    dir: string,
  ): Promise<ExtensionContractResult> {
    const encodedName = encodeURIComponent(name);
    return this.wrapCall(
      () =>
        this.client.get(`/configurations/${encodedName}`, {
          params: { dir },
        }),
      "/configurations",
    );
  }

  // Mirrors: Configurations.createOrUpdate(configName, cfg, dir) → PUT configurations/:name?dir=...
  // Note: The real extension uses `configurations/` (no leading slash) for this method.
  async createOrUpdateConfiguration(
    name: string,
    body: unknown,
    dir: string,
  ): Promise<ExtensionContractResult> {
    const encodedName = encodeURIComponent(name);
    return this.wrapCall(
      () =>
        this.client.put(`configurations/${encodedName}`, body, {
          params: { dir },
        }),
      "/configurations",
    );
  }

  // Mirrors: Configurations.delete(configName, dir) → DELETE configurations/:name?dir=...
  // Note: The real extension uses `configurations/` (no leading slash) for this method.
  async deleteConfiguration(
    name: string,
    dir: string,
  ): Promise<ExtensionContractResult> {
    const encodedName = encodeURIComponent(name);
    return this.wrapCall(
      () =>
        this.client.delete(`configurations/${encodedName}`, {
          params: { dir },
        }),
      "/configurations",
    );
  }

  // --- Credentials ---

  // Mirrors: Credentials.list() → GET credentials
  // Note: The real extension uses `credentials` (no leading slash).
  async listCredentials(): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () => this.client.get("credentials"),
      "/credentials",
    );
  }

  // Mirrors: Credentials.connectCreate(data, serverType) → POST credentials
  // Note: The real extension uses `credentials` (no leading slash).
  async createCredential(body: unknown): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () => this.client.post("credentials", body),
      "/credentials",
    );
  }

  // Mirrors: Credentials.get(guid) → GET credentials/:guid
  async getCredential(guid: string): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () => this.client.get(`credentials/${guid}`),
      "/credentials",
    );
  }

  // Mirrors: Credentials.delete(guid) → DELETE credentials/:guid
  async deleteCredential(guid: string): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () => this.client.delete(`credentials/${guid}`),
      "/credentials",
    );
  }

  // Mirrors: Credentials.reset() → DELETE credentials
  async resetCredentials(): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () => this.client.delete("credentials"),
      "/credentials",
    );
  }

  // Mirrors: Credentials.test(url, insecure, apiKey?) → POST test-credentials
  // Note: The real extension uses `test-credentials` (no leading slash).
  async testCredentials(
    url: string,
    insecure: boolean,
    apiKey?: string,
  ): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () =>
        this.client.post("test-credentials", {
          url,
          apiKey,
          insecure,
        }),
      "/test-credentials",
    );
  }

  // --- Deployments ---

  // Mirrors: ContentRecords.getAll(dir) → GET /deployments?dir=...
  // Note: The real extension uses `/deployments` (leading slash).
  async getDeployments(dir: string): Promise<ExtensionContractResult> {
    return this.wrapCall(
      () =>
        this.client.get("/deployments", {
          params: { dir },
        }),
      "/deployments",
    );
  }

  // Mirrors: ContentRecords.get(id, dir) → GET deployments/:id?dir=...
  // Note: The real extension uses `deployments/` (no leading slash).
  async getDeployment(
    id: string,
    dir: string,
  ): Promise<ExtensionContractResult> {
    const encodedId = encodeURIComponent(id);
    return this.wrapCall(
      () =>
        this.client.get(`deployments/${encodedId}`, {
          params: { dir },
        }),
      "/deployments",
    );
  }

  // Mirrors: ContentRecords.createNew(dir, account?, config?, saveName?) → POST /deployments?dir=...
  // Note: The real extension uses `/deployments` (leading slash).
  async createDeployment(
    dir: string,
    account?: string,
    config?: string,
    saveName?: string,
  ): Promise<ExtensionContractResult> {
    const data = {
      account,
      config,
      saveName,
    };
    return this.wrapCall(
      () =>
        this.client.post("/deployments", data, {
          params: { dir },
        }),
      "/deployments",
    );
  }

  // Mirrors: ContentRecords.delete(saveName, dir) → DELETE deployments/:name?dir=...
  // Note: The real extension uses `deployments/` (no leading slash).
  async deleteDeployment(
    saveName: string,
    dir: string,
  ): Promise<ExtensionContractResult> {
    const encodedSaveName = encodeURIComponent(saveName);
    return this.wrapCall(
      () =>
        this.client.delete(`deployments/${encodedSaveName}`, {
          params: { dir },
        }),
      "/deployments",
    );
  }

  // Mirrors: ContentRecords.patch(name, dir, data) → PATCH deployments/:name?dir=...
  // Note: The real extension uses `deployments/` (no leading slash).
  async patchDeployment(
    name: string,
    dir: string,
    data: { configName?: string; guid?: string },
  ): Promise<ExtensionContractResult> {
    const encodedName = encodeURIComponent(name);
    return this.wrapCall(
      () =>
        this.client.patch(
          `deployments/${encodedName}`,
          {
            configurationName: data.configName,
            id: data.guid,
          },
          {
            params: { dir },
          },
        ),
      "/deployments",
    );
  }
}
