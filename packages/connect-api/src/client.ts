// Copyright (C) 2026 by Posit Software, PBC.

import axios from "axios";
import type { AxiosInstance } from "axios";

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

/**
 * TypeScript client for the Posit Connect API.
 *
 * Uses axios for HTTP requests. Non-2xx responses throw AxiosError by default.
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
    });
  }

  /**
   * Validates credentials and checks user state (locked, confirmed, role).
   * Returns the full UserDTO on success; throws on HTTP errors or invalid state.
   */
  async testAuthentication(): Promise<UserDTO> {
    let data: UserDTO;
    try {
      ({ data } = await this.client.request<UserDTO>({
        method: "GET",
        url: "/__api__/v1/user",
      }));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const errorBody = err.response?.data;
        const msg =
          typeof errorBody?.error === "string"
            ? errorBody.error
            : `HTTP ${err.response?.status}`;
        throw new Error(msg);
      }
      throw err;
    }

    if (data.locked) {
      throw new Error(`user account ${data.username} is locked`);
    }

    if (!data.confirmed) {
      throw new Error(`user account ${data.username} is not confirmed`);
    }

    if (data.user_role !== "publisher" && data.user_role !== "administrator") {
      throw new Error(
        `user account ${data.username} with role '${data.user_role}' does not have permission to publish content`,
      );
    }

    return data;
  }

  /** Retrieves the current authenticated user without validation checks. */
  async getCurrentUser(): Promise<UserDTO> {
    const { data } = await this.client.request<UserDTO>({
      method: "GET",
      url: "/__api__/v1/user",
    });
    return data;
  }

  /** Fetches details for a content item by ID. */
  async contentDetails(contentId: ContentID): Promise<ContentDetailsDTO> {
    const { data } = await this.client.request<ContentDetailsDTO>({
      method: "GET",
      url: `/__api__/v1/content/${contentId}`,
    });
    return data;
  }

  /** Creates a new content item and returns the full content details. */
  async createDeployment(body: ConnectContent): Promise<ContentDetailsDTO> {
    const { data } = await this.client.request<ContentDetailsDTO>({
      method: "POST",
      url: "/__api__/v1/content",
      data: body,
    });
    return data;
  }

  /** Updates an existing content item. */
  async updateDeployment(
    contentId: ContentID,
    body: ConnectContent,
  ): Promise<void> {
    await this.client.request({
      method: "PATCH",
      url: `/__api__/v1/content/${contentId}`,
      data: body,
    });
  }

  /** Retrieves environment variable names for a content item. */
  async getEnvVars(contentId: ContentID): Promise<string[]> {
    const { data } = await this.client.request<string[]>({
      method: "GET",
      url: `/__api__/v1/content/${contentId}/environment`,
    });
    return data;
  }

  /** Sets environment variables for a content item. */
  async setEnvVars(
    contentId: ContentID,
    env: Record<string, string>,
  ): Promise<void> {
    await this.client.request({
      method: "PATCH",
      url: `/__api__/v1/content/${contentId}/environment`,
      data: Object.entries(env).map(([name, value]) => ({ name, value })),
    });
  }

  /** Uploads a bundle archive (gzip) for a content item. */
  async uploadBundle(
    contentId: ContentID,
    bundle: Uint8Array,
  ): Promise<BundleDTO> {
    const { data } = await this.client.request<BundleDTO>({
      method: "POST",
      url: `/__api__/v1/content/${contentId}/bundles`,
      data: bundle,
      headers: { "Content-Type": "application/gzip" },
    });
    return data;
  }

  /** Retrieves content details (including bundle_id) for a content item. */
  async latestBundleId(contentId: ContentID): Promise<ContentDetailsDTO> {
    return this.contentDetails(contentId);
  }

  /** Downloads a bundle archive as raw bytes. */
  async downloadBundle(
    contentId: ContentID,
    bundleId: BundleID,
  ): Promise<Uint8Array> {
    const { data } = await this.client.request<ArrayBuffer>({
      method: "GET",
      url: `/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
      responseType: "arraybuffer",
    });
    return new Uint8Array(data);
  }

  /** Initiates deployment of a specific bundle. */
  async deployBundle(
    contentId: ContentID,
    bundleId: BundleID,
  ): Promise<DeployOutput> {
    const { data } = await this.client.request<DeployOutput>({
      method: "POST",
      url: `/__api__/v1/content/${contentId}/deploy`,
      data: { bundle_id: bundleId },
    });
    return data;
  }

  /**
   * Polls for task completion.
   * @param pollIntervalMs - milliseconds between polls (default 500, pass 0 for tests)
   */
  async waitForTask(taskId: TaskID, pollIntervalMs = 500): Promise<TaskDTO> {
    let firstLine = 0;

    while (true) {
      const { data: task } = await this.client.request<TaskDTO>({
        method: "GET",
        url: `/__api__/v1/tasks/${taskId}?first=${firstLine}`,
      });

      if (task.finished) {
        if (task.error) {
          throw new Error(task.error);
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
   * Status >= 500 throws; 404 and other codes are acceptable.
   */
  async validateDeployment(contentId: ContentID): Promise<void> {
    await this.client.request({
      method: "GET",
      url: `/content/${contentId}/`,
      validateStatus: (status) => status < 500,
    });
  }

  /** Retrieves OAuth integrations from the server. */
  async getIntegrations(): Promise<Integration[]> {
    const { data } = await this.client.request<Integration[]>({
      method: "GET",
      url: "/__api__/v1/oauth/integrations",
    });
    return data;
  }

  /**
   * Fetches composite server settings from 7 separate endpoints,
   * mirroring the Go client's GetSettings behavior.
   */
  async getSettings(): Promise<AllSettings> {
    const [
      { data: user },
      { data: general },
      { data: application },
      { data: scheduler },
      { data: python },
      { data: r },
      { data: quarto },
    ] = await Promise.all([
      this.client.request<UserDTO>({
        method: "GET",
        url: "/__api__/v1/user",
      }),
      this.client.request<ServerSettings>({
        method: "GET",
        url: "/__api__/server_settings",
      }),
      this.client.request<ApplicationSettings>({
        method: "GET",
        url: "/__api__/server_settings/applications",
      }),
      this.client.request<SchedulerSettings>({
        method: "GET",
        url: "/__api__/server_settings/scheduler",
      }),
      this.client.request<PyInfo>({
        method: "GET",
        url: "/__api__/v1/server_settings/python",
      }),
      this.client.request<RInfo>({
        method: "GET",
        url: "/__api__/v1/server_settings/r",
      }),
      this.client.request<QuartoInfo>({
        method: "GET",
        url: "/__api__/v1/server_settings/quarto",
      }),
    ]);

    return { general, user, application, scheduler, python, r, quarto };
  }
}
