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
      ({ data } = await this.client.get<UserDTO>("/__api__/v1/user"));
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
  async getCurrentUser(): Promise<AxiosResponse<UserDTO>> {
    return this.client.get<UserDTO>("/__api__/v1/user");
  }

  /** Fetches details for a content item by ID. */
  async contentDetails(
    contentId: ContentID,
  ): Promise<AxiosResponse<ContentDetailsDTO>> {
    return this.client.get<ContentDetailsDTO>(
      `/__api__/v1/content/${contentId}`,
    );
  }

  /** Creates a new content item and returns the full content details. */
  async createDeployment(
    body: ConnectContent,
  ): Promise<AxiosResponse<ContentDetailsDTO>> {
    return this.client.post<ContentDetailsDTO>("/__api__/v1/content", body);
  }

  /** Updates an existing content item. */
  async updateDeployment(
    contentId: ContentID,
    body: ConnectContent,
  ): Promise<void> {
    await this.client.patch(`/__api__/v1/content/${contentId}`, body);
  }

  /** Retrieves environment variable names for a content item. */
  async getEnvVars(contentId: ContentID): Promise<AxiosResponse<string[]>> {
    return this.client.get<string[]>(
      `/__api__/v1/content/${contentId}/environment`,
    );
  }

  /** Sets environment variables for a content item. */
  async setEnvVars(
    contentId: ContentID,
    env: Record<string, string>,
  ): Promise<void> {
    await this.client.patch(
      `/__api__/v1/content/${contentId}/environment`,
      Object.entries(env).map(([name, value]) => ({ name, value })),
    );
  }

  /** Uploads a bundle archive (gzip) for a content item. */
  async uploadBundle(
    contentId: ContentID,
    bundle: Uint8Array,
  ): Promise<AxiosResponse<BundleDTO>> {
    return this.client.post<BundleDTO>(
      `/__api__/v1/content/${contentId}/bundles`,
      bundle,
      { headers: { "Content-Type": "application/gzip" } },
    );
  }

  /** Retrieves content details (including bundle_id) for a content item. */
  async latestBundleId(
    contentId: ContentID,
  ): Promise<AxiosResponse<ContentDetailsDTO>> {
    return this.contentDetails(contentId);
  }

  /** Downloads a bundle archive as raw bytes. */
  async downloadBundle(
    contentId: ContentID,
    bundleId: BundleID,
  ): Promise<Uint8Array> {
    const { data } = await this.client.get<ArrayBuffer>(
      `/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
      { responseType: "arraybuffer" },
    );
    return new Uint8Array(data);
  }

  /** Initiates deployment of a specific bundle. */
  async deployBundle(
    contentId: ContentID,
    bundleId: BundleID,
  ): Promise<AxiosResponse<DeployOutput>> {
    return this.client.post<DeployOutput>(
      `/__api__/v1/content/${contentId}/deploy`,
      { bundle_id: bundleId },
    );
  }

  /**
   * Polls for task completion.
   * @param pollIntervalMs - milliseconds between polls (default 500, pass 0 for tests)
   */
  async waitForTask(taskId: TaskID, pollIntervalMs = 500): Promise<TaskDTO> {
    let firstLine = 0;

    while (true) {
      const { data: task } = await this.client.get<TaskDTO>(
        `/__api__/v1/tasks/${taskId}`,
        { params: { first: firstLine } },
      );

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
    await this.client.get(`/content/${contentId}/`, {
      validateStatus: (status: number) => status < 500,
    });
  }

  /** Retrieves OAuth integrations from the server. */
  async getIntegrations(): Promise<AxiosResponse<Integration[]>> {
    return this.client.get<Integration[]>("/__api__/v1/oauth/integrations");
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
      this.client.get<UserDTO>("/__api__/v1/user"),
      this.client.get<ServerSettings>("/__api__/server_settings"),
      this.client.get<ApplicationSettings>(
        "/__api__/server_settings/applications",
      ),
      this.client.get<SchedulerSettings>("/__api__/server_settings/scheduler"),
      this.client.get<PyInfo>("/__api__/v1/server_settings/python"),
      this.client.get<RInfo>("/__api__/v1/server_settings/r"),
      this.client.get<QuartoInfo>("/__api__/v1/server_settings/quarto"),
    ]);

    return { general, user, application, scheduler, python, r, quarto };
  }
}
