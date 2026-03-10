// Copyright (C) 2026 by Posit Software, PBC.

import axios from "axios";
import type { AxiosInstance, AxiosResponse } from "axios";

import type {
  AllSettings,
  ApplicationSettings,
  BundleDTO,
  BundleID,
  ConnectAPIOptions,
  ConnectContent,
  ContentDetailsDTO,
  ContentID,
  DeployOutput,
  Integration,
  PyInfo,
  QuartoInfo,
  RInfo,
  SchedulerSettings,
  ServerSettings,
  TaskDTO,
  TaskID,
  UserDTO,
} from "./types.js";

import {
  AuthenticationError,
  ConnectRequestError,
  DeploymentValidationError,
  TaskError,
} from "./errors.js";

/**
 * TypeScript client for the Posit Connect API.
 *
 * Uses axios for HTTP requests.
 * Property names use snake_case to match the Connect API JSON wire format.
 */
export class ConnectAPI {
  private readonly client: AxiosInstance;

  constructor(options: ConnectAPIOptions) {
    this.client = axios.create({
      baseURL: options.url,
      headers: {
        Authorization: `Key ${options.apiKey}`,
      },
      validateStatus: () => true,
    });
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
      responseType?: "arraybuffer";
    },
  ): Promise<AxiosResponse> {
    const headers: Record<string, string> = {};

    let data: unknown;
    if (options?.rawBody) {
      headers["Content-Type"] =
        options.contentType ?? "application/octet-stream";
      data = options.rawBody;
    } else if (options?.body !== undefined) {
      headers["Content-Type"] = options.contentType ?? "application/json";
      data = options.body;
    }

    return this.client.request({
      method,
      url: path,
      headers,
      data,
      responseType: options?.responseType,
    });
  }

  private async requestJson<T>(
    method: string,
    path: string,
    options?: { body?: unknown },
  ): Promise<T> {
    const resp = await this.request(method, path, options);
    if (resp.status < 200 || resp.status >= 300) {
      const body =
        typeof resp.data === "string"
          ? resp.data
          : JSON.stringify(resp.data ?? "");
      throw new ConnectRequestError(resp.status, resp.statusText, body);
    }
    return resp.data as T;
  }

  // ---------------------------------------------------------------------------
  // API methods
  // ---------------------------------------------------------------------------

  /**
   * Validates credentials and checks user state (locked, confirmed, role).
   * Returns the full UserDTO on success; throws AuthenticationError otherwise.
   */
  async testAuthentication(): Promise<UserDTO> {
    const resp = await this.request("GET", "/__api__/v1/user");

    if (resp.status < 200 || resp.status >= 300) {
      const errorBody = (resp.data ?? {}) as Record<string, unknown>;
      const msg = (errorBody.error as string) ?? `HTTP ${resp.status}`;
      throw new AuthenticationError(msg);
    }

    const dto = resp.data as UserDTO;

    if (dto.locked) {
      const msg = `user account ${dto.username} is locked`;
      throw new AuthenticationError(msg);
    }

    if (!dto.confirmed) {
      const msg = `user account ${dto.username} is not confirmed`;
      throw new AuthenticationError(msg);
    }

    if (dto.user_role !== "publisher" && dto.user_role !== "administrator") {
      const msg = `user account ${dto.username} with role '${dto.user_role}' does not have permission to publish content`;
      throw new AuthenticationError(msg);
    }

    return dto;
  }

  /** Retrieves the current authenticated user without validation checks. */
  async getCurrentUser(): Promise<UserDTO> {
    return this.requestJson<UserDTO>("GET", "/__api__/v1/user");
  }

  /** Fetches details for a content item by ID. */
  async contentDetails(contentId: ContentID): Promise<ContentDetailsDTO> {
    return this.requestJson<ContentDetailsDTO>(
      "GET",
      `/__api__/v1/content/${contentId}`,
    );
  }

  /** Creates a new content item and returns the full content details. */
  async createDeployment(body: ConnectContent): Promise<ContentDetailsDTO> {
    return this.requestJson<ContentDetailsDTO>(
      "POST",
      "/__api__/v1/content",
      { body },
    );
  }

  /** Updates an existing content item. */
  async updateDeployment(
    contentId: ContentID,
    body: ConnectContent,
  ): Promise<void> {
    const resp = await this.request(
      "PATCH",
      `/__api__/v1/content/${contentId}`,
      {
        body,
      },
    );
    if (resp.status < 200 || resp.status >= 300) {
      const respBody =
        typeof resp.data === "string"
          ? resp.data
          : JSON.stringify(resp.data ?? "");
      throw new ConnectRequestError(resp.status, resp.statusText, respBody);
    }
  }

  /** Retrieves environment variable names for a content item. */
  async getEnvVars(contentId: ContentID): Promise<string[]> {
    return this.requestJson<string[]>(
      "GET",
      `/__api__/v1/content/${contentId}/environment`,
    );
  }

  /** Sets environment variables for a content item. */
  async setEnvVars(
    contentId: ContentID,
    env: Record<string, string>,
  ): Promise<void> {
    const body = Object.entries(env).map(([name, value]) => ({ name, value }));
    const resp = await this.request(
      "PATCH",
      `/__api__/v1/content/${contentId}/environment`,
      { body },
    );
    if (resp.status < 200 || resp.status >= 300) {
      const respBody =
        typeof resp.data === "string"
          ? resp.data
          : JSON.stringify(resp.data ?? "");
      throw new ConnectRequestError(resp.status, resp.statusText, respBody);
    }
  }

  /** Uploads a bundle archive (gzip) for a content item. */
  async uploadBundle(
    contentId: ContentID,
    data: Uint8Array,
  ): Promise<BundleDTO> {
    const resp = await this.request(
      "POST",
      `/__api__/v1/content/${contentId}/bundles`,
      { rawBody: data, contentType: "application/gzip" },
    );
    if (resp.status < 200 || resp.status >= 300) {
      const body =
        typeof resp.data === "string"
          ? resp.data
          : JSON.stringify(resp.data ?? "");
      throw new ConnectRequestError(resp.status, resp.statusText, body);
    }
    return resp.data as BundleDTO;
  }

  /** Retrieves content details (including bundle_id) for a content item. */
  async latestBundleId(contentId: ContentID): Promise<ContentDetailsDTO> {
    return this.requestJson<ContentDetailsDTO>(
      "GET",
      `/__api__/v1/content/${contentId}`,
    );
  }

  /** Downloads a bundle archive as raw bytes. */
  async downloadBundle(
    contentId: ContentID,
    bundleId: BundleID,
  ): Promise<Uint8Array> {
    const resp = await this.request(
      "GET",
      `/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
      { responseType: "arraybuffer" },
    );
    if (resp.status < 200 || resp.status >= 300) {
      const body =
        typeof resp.data === "string"
          ? resp.data
          : JSON.stringify(resp.data ?? "");
      throw new ConnectRequestError(resp.status, resp.statusText, body);
    }
    return new Uint8Array(resp.data as ArrayBuffer);
  }

  /** Initiates deployment of a specific bundle. */
  async deployBundle(
    contentId: ContentID,
    bundleId: BundleID,
  ): Promise<DeployOutput> {
    return this.requestJson<DeployOutput>(
      "POST",
      `/__api__/v1/content/${contentId}/deploy`,
      { body: { bundle_id: bundleId } },
    );
  }

  /**
   * Polls for task completion.
   * @param pollIntervalMs - milliseconds between polls (default 500, pass 0 for tests)
   */
  async waitForTask(
    taskId: TaskID,
    pollIntervalMs = 500,
  ): Promise<TaskDTO> {
    let firstLine = 0;

    for (;;) {
      const task = await this.requestJson<TaskDTO>(
        "GET",
        `/__api__/v1/tasks/${taskId}?first=${firstLine}`,
      );

      if (task.finished) {
        if (task.error) {
          throw new TaskError(taskId, task.error, task.code);
        }
        return task;
      }

      firstLine = task.last;

      if (pollIntervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }

  /**
   * Validates that deployed content is reachable by hitting its content URL.
   * Status >= 500 is an error; 404 and other codes are acceptable.
   */
  async validateDeployment(contentId: ContentID): Promise<void> {
    const resp = await this.request("GET", `/content/${contentId}/`);
    if (resp.status >= 500) {
      throw new DeploymentValidationError(contentId, resp.status);
    }
  }

  /** Retrieves OAuth integrations from the server. */
  async getIntegrations(): Promise<Integration[]> {
    return this.requestJson<Integration[]>(
      "GET",
      "/__api__/v1/oauth/integrations",
    );
  }

  /**
   * Fetches composite server settings from 7 separate endpoints,
   * mirroring the Go client's GetSettings behavior.
   */
  async getSettings(): Promise<AllSettings> {
    const user = await this.requestJson<UserDTO>("GET", "/__api__/v1/user");
    const General = await this.requestJson<ServerSettings>(
      "GET",
      "/__api__/server_settings",
    );
    const application = await this.requestJson<ApplicationSettings>(
      "GET",
      "/__api__/server_settings/applications",
    );
    const scheduler = await this.requestJson<SchedulerSettings>(
      "GET",
      "/__api__/server_settings/scheduler",
    );
    const python = await this.requestJson<PyInfo>(
      "GET",
      "/__api__/v1/server_settings/python",
    );
    const r = await this.requestJson<RInfo>(
      "GET",
      "/__api__/v1/server_settings/r",
    );
    const quarto = await this.requestJson<QuartoInfo>(
      "GET",
      "/__api__/v1/server_settings/quarto",
    );

    return { General, user, application, scheduler, python, r, quarto };
  }
}
