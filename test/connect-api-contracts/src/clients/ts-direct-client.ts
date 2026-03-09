// Copyright (C) 2026 by Posit Software, PBC.

import type {
  ConnectContractClient,
  ConnectContractResult,
  ConnectContractStatus,
  MethodName,
} from "../client";
import { Method } from "../client";
import type { CapturedRequest } from "../mock-connect-server";

/**
 * Error class that carries a structured result alongside the error message.
 * Used for methods like TestAuthentication that return both a result and an
 * error status (e.g. { user: null, error: { msg: "..." } }).
 */
class ClientError extends Error {
  constructor(
    message: string,
    public result: unknown = undefined,
  ) {
    super(message);
  }
}

/**
 * TypeScript implementation of the Connect API client.
 * Makes HTTP requests directly to the Connect server (or mock) and returns
 * results in the same shape as the Go publisher client.
 */
export class TypeScriptDirectClient implements ConnectContractClient {
  constructor(
    private connectUrl: string,
    private apiKey: string,
  ) {}

  async call(
    method: MethodName,
    params?: Record<string, unknown>,
  ): Promise<ConnectContractResult> {
    // Clear captured requests before the call
    await this.clearCapturedRequests();

    let result: unknown = undefined;
    let status: ConnectContractStatus = "success";

    try {
      result = await this.dispatch(method, params ?? {});
    } catch (err) {
      status = "error";
      if (err instanceof ClientError) {
        result = err.result;
      }
    }

    // Fetch captured requests after the call
    const capturedRequests = await this.fetchCapturedRequests();

    return {
      status,
      result,
      capturedRequest: capturedRequests.length > 0 ? capturedRequests[0] : null,
      capturedRequests,
    };
  }

  private async dispatch(
    method: MethodName,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (method) {
      case Method.TestAuthentication:
        return this.testAuthentication();
      case Method.GetCurrentUser:
        return this.getCurrentUser();
      case Method.ContentDetails:
        return this.contentDetails(params.contentId as string);
      case Method.CreateDeployment:
        return this.createDeployment(
          (params.body as Record<string, unknown>) ?? {},
        );
      case Method.UpdateDeployment:
        return this.updateDeployment(
          params.contentId as string,
          (params.body as Record<string, unknown>) ?? {},
        );
      case Method.GetEnvVars:
        return this.getEnvVars(params.contentId as string);
      case Method.SetEnvVars:
        return this.setEnvVars(
          params.contentId as string,
          params.env as Record<string, string>,
        );
      case Method.UploadBundle:
        return this.uploadBundle(
          params.contentId as string,
          params.bundleData as Uint8Array,
        );
      case Method.LatestBundleID:
        return this.latestBundleID(params.contentId as string);
      case Method.DownloadBundle:
        return this.downloadBundle(
          params.contentId as string,
          params.bundleId as string,
        );
      case Method.DeployBundle:
        return this.deployBundle(
          params.contentId as string,
          params.bundleId as string,
        );
      case Method.WaitForTask:
        return this.waitForTask(params.taskId as string);
      case Method.ValidateDeployment:
        return this.validateDeployment(params.contentId as string);
      case Method.GetIntegrations:
        return this.getIntegrations();
      case Method.GetSettings:
        return this.getSettings();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private async request(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      contentType?: string;
      rawBody?: Uint8Array;
    },
  ): Promise<Response> {
    const url = `${this.connectUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Key ${this.apiKey}`,
    };

    let body: BodyInit | undefined;
    if (options?.rawBody) {
      headers["Content-Type"] =
        options.contentType ?? "application/octet-stream";
      body = Buffer.from(options.rawBody);
    } else if (options?.body !== undefined) {
      headers["Content-Type"] = options?.contentType ?? "application/json";
      body = JSON.stringify(options.body);
    }

    return fetch(url, { method, headers, body });
  }

  private async getJSON<T>(path: string): Promise<T> {
    const resp = await this.request("GET", path);
    if (!resp.ok) {
      throw new ClientError(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return resp.json() as Promise<T>;
  }

  private async postJSON<T>(path: string, body: unknown): Promise<T> {
    const resp = await this.request("POST", path, { body });
    if (!resp.ok) {
      throw new ClientError(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return resp.json() as Promise<T>;
  }

  private async patchJSON(path: string, body: unknown): Promise<void> {
    const resp = await this.request("PATCH", path, { body });
    if (!resp.ok) {
      throw new ClientError(`HTTP ${resp.status}: ${resp.statusText}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Mock server test infrastructure
  // ---------------------------------------------------------------------------

  private async clearCapturedRequests(): Promise<void> {
    await fetch(`${this.connectUrl}/__test__/requests`, { method: "DELETE" });
  }

  private async fetchCapturedRequests(): Promise<CapturedRequest[]> {
    const resp = await fetch(`${this.connectUrl}/__test__/requests`);
    return resp.json() as Promise<CapturedRequest[]>;
  }

  // ---------------------------------------------------------------------------
  // API method implementations
  // ---------------------------------------------------------------------------

  /**
   * Validates credentials and checks user state (locked, confirmed, role).
   * Returns { user, error } on both success and failure, matching the Go
   * client's TestAuthentication contract.
   */
  private async testAuthentication(): Promise<{
    user: {
      id: string;
      username: string;
      first_name: string;
      last_name: string;
      email: string;
    } | null;
    error: { msg: string } | null;
  }> {
    const resp = await this.request("GET", "/__api__/v1/user");

    if (!resp.ok) {
      const errorBody = (await resp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const msg = (errorBody.error as string) ?? `HTTP ${resp.status}`;
      throw new ClientError(msg, { user: null, error: { msg } });
    }

    const dto = (await resp.json()) as {
      guid: string;
      username: string;
      first_name: string;
      last_name: string;
      email: string;
      user_role: string;
      confirmed: boolean;
      locked: boolean;
    };

    if (dto.locked) {
      const msg = `user account ${dto.username} is locked`;
      throw new ClientError(msg, { user: null, error: { msg } });
    }

    if (!dto.confirmed) {
      const msg = `user account ${dto.username} is not confirmed`;
      throw new ClientError(msg, { user: null, error: { msg } });
    }

    if (dto.user_role !== "publisher" && dto.user_role !== "administrator") {
      const msg = `user account ${dto.username} with role '${dto.user_role}' does not have permission to publish content`;
      throw new ClientError(msg, { user: null, error: { msg } });
    }

    return {
      user: {
        id: dto.guid,
        username: dto.username,
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
      },
      error: null,
    };
  }

  /**
   * Retrieves the current authenticated user without validation checks.
   */
  private async getCurrentUser(): Promise<{
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  }> {
    const dto = await this.getJSON<{
      guid: string;
      username: string;
      first_name: string;
      last_name: string;
      email: string;
    }>("/__api__/v1/user");

    return {
      id: dto.guid,
      username: dto.username,
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
    };
  }

  /**
   * Fetches details for a content item by ID.
   */
  private async contentDetails(
    contentId: string,
  ): Promise<Record<string, unknown>> {
    return this.getJSON<Record<string, unknown>>(
      `/__api__/v1/content/${contentId}`,
    );
  }

  /**
   * Creates a new content item (deployment) and returns its GUID.
   */
  private async createDeployment(
    body: Record<string, unknown>,
  ): Promise<{ contentId: string }> {
    const content = await this.postJSON<{ guid: string }>(
      "/__api__/v1/content",
      body,
    );
    return { contentId: content.guid };
  }

  /**
   * Updates an existing content item. Returns void (204 no-body response).
   */
  private async updateDeployment(
    contentId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    await this.patchJSON(`/__api__/v1/content/${contentId}`, body);
  }

  /**
   * Retrieves environment variable names for a content item.
   */
  private async getEnvVars(contentId: string): Promise<string[]> {
    return this.getJSON<string[]>(
      `/__api__/v1/content/${contentId}/environment`,
    );
  }

  /**
   * Sets environment variables for a content item.
   * Converts { name: value } map to [{ name, value }] array format.
   */
  private async setEnvVars(
    contentId: string,
    env: Record<string, string>,
  ): Promise<void> {
    const body = Object.entries(env).map(([name, value]) => ({ name, value }));
    await this.patchJSON(
      `/__api__/v1/content/${contentId}/environment`,
      body,
    );
  }

  /**
   * Uploads a bundle archive (gzip) for a content item.
   */
  private async uploadBundle(
    contentId: string,
    bundleData: Uint8Array,
  ): Promise<{ bundleId: string }> {
    const resp = await this.request(
      "POST",
      `/__api__/v1/content/${contentId}/bundles`,
      {
        rawBody: bundleData,
        contentType: "application/gzip",
      },
    );
    if (!resp.ok) {
      throw new ClientError(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const bundle = (await resp.json()) as { id: string };
    return { bundleId: bundle.id };
  }

  /**
   * Retrieves the latest bundle ID from a content item's details.
   */
  private async latestBundleID(
    contentId: string,
  ): Promise<{ bundleId: string }> {
    const content = await this.getJSON<{ bundle_id: string }>(
      `/__api__/v1/content/${contentId}`,
    );
    return { bundleId: content.bundle_id };
  }

  /**
   * Downloads a bundle archive as raw bytes.
   */
  private async downloadBundle(
    contentId: string,
    bundleId: string,
  ): Promise<Uint8Array> {
    const resp = await this.request(
      "GET",
      `/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
    );
    if (!resp.ok) {
      throw new ClientError(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const buffer = await resp.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Initiates deployment of a specific bundle and returns the task ID.
   */
  private async deployBundle(
    contentId: string,
    bundleId: string,
  ): Promise<{ taskId: string }> {
    const result = await this.postJSON<{ task_id: string }>(
      `/__api__/v1/content/${contentId}/deploy`,
      { bundle_id: bundleId },
    );
    return { taskId: result.task_id };
  }

  /**
   * Polls for task completion. Returns { finished: true } on success,
   * throws on task failure (non-zero exit code).
   */
  private async waitForTask(
    taskId: string,
  ): Promise<{ finished: boolean }> {
    let firstLine = 0;

    for (;;) {
      const task = await this.getJSON<{
        id: string;
        output: string[];
        result: unknown;
        finished: boolean;
        code: number;
        error: string;
        last: number;
      }>(`/__api__/v1/tasks/${taskId}?first=${firstLine}`);

      if (task.finished) {
        if (task.error) {
          throw new ClientError(task.error);
        }
        return { finished: true };
      }

      firstLine = task.last;
      // In production, we'd sleep between polls. The mock always returns
      // finished=true so this loop completes in one iteration.
    }
  }

  /**
   * Validates that deployed content is reachable by hitting its content URL.
   * Status >= 500 is an error; 404 and other codes are acceptable.
   */
  private async validateDeployment(contentId: string): Promise<void> {
    const resp = await this.request("GET", `/content/${contentId}/`);
    await resp.text(); // consume body
    if (resp.status >= 500) {
      throw new ClientError(
        "deployed content does not seem to be running",
      );
    }
  }

  /**
   * Retrieves OAuth integrations from the server.
   */
  private async getIntegrations(): Promise<unknown[]> {
    return this.getJSON<unknown[]>("/__api__/v1/oauth/integrations");
  }

  /**
   * Fetches composite server settings from 7 separate endpoints,
   * mirroring the Go client's GetSettings behavior.
   */
  private async getSettings(): Promise<Record<string, unknown>> {
    const user = await this.getJSON<Record<string, unknown>>(
      "/__api__/v1/user",
    );
    const general = await this.getJSON<Record<string, unknown>>(
      "/__api__/server_settings",
    );
    const application = await this.getJSON<Record<string, unknown>>(
      "/__api__/server_settings/applications",
    );
    const scheduler = await this.getJSON<Record<string, unknown>>(
      "/__api__/server_settings/scheduler",
    );
    const python = await this.getJSON<Record<string, unknown>>(
      "/__api__/v1/server_settings/python",
    );
    const r = await this.getJSON<Record<string, unknown>>(
      "/__api__/v1/server_settings/r",
    );
    const quarto = await this.getJSON<Record<string, unknown>>(
      "/__api__/v1/server_settings/quarto",
    );

    return {
      General: general,
      user,
      application,
      scheduler,
      python,
      r,
      quarto,
    };
  }
}
