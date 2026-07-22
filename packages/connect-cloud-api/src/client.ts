// Copyright (C) 2026 by Posit Software, PBC.

import { Readable } from "stream";
import axios from "axios";
import type { AxiosInstance } from "axios";

import { CloudAuthClient } from "./auth.js";
import { attachRedirectHandling } from "./redirects.js";
import type {
  Account,
  AccountListResponse,
  AuthorizationRequest,
  AuthorizationResponse,
  CloudEnvironment,
  ConnectCloudAPIOptions,
  ContentID,
  ContentResponse,
  CreateContentRequest,
  Revision,
  TokenResponse,
  UpdateContentRequest,
  UserResponse,
} from "./types.js";

// Presigned-URL uploads bypass the authenticated client; give them their own
// instance so redirect handling (fresh stream per hop) still applies.
// `maxRedirects: 0` keeps axios on its native streaming transport. Created once
// at module load — it holds no per-request or credential state.
const uploadClient = axios.create({ maxRedirects: 0 });
attachRedirectHandling(uploadClient);

/**
 * TypeScript client for the Posit Connect Cloud API.
 *
 * Uses axios for HTTP requests. Non-2xx responses throw AxiosError by default.
 * Property names use snake_case to match the Connect Cloud API JSON wire format.
 *
 * Supports automatic token refresh on 401 responses when `refreshToken` and
 * `environment` are provided in options.
 */
export class ConnectCloudAPI {
  private readonly client: AxiosInstance;
  private accessToken: string;
  private refreshToken?: string;
  private readonly environment?: CloudEnvironment;
  private readonly onTokenRefresh?: (tokens: TokenResponse) => Promise<void>;

  constructor(options: ConnectCloudAPIOptions) {
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.environment = options.environment;
    this.onTokenRefresh = options.onTokenRefresh;

    // `maxRedirects: 0` keeps axios on its native http/https transport (which
    // truly streams request bodies); redirects are followed manually by
    // `attachRedirectHandling`, which re-issues each hop through this instance
    // so the Bearer-token request interceptor re-runs and forwards the token to
    // the redirect target.
    this.client = axios.create({
      baseURL: options.apiBaseUrl,
      maxRedirects: 0,
    });
    attachRedirectHandling(this.client);

    // Use request interceptor to set auth header dynamically (token may change after refresh)
    this.client.interceptors.request.use((config) => {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });
  }

  /**
   * Returns true if this client is configured to support token refresh.
   */
  private canRefreshToken(): boolean {
    return this.refreshToken !== undefined && this.environment !== undefined;
  }

  /**
   * Refreshes the access token using the refresh token.
   * Updates internal state and calls onTokenRefresh callback if provided.
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.canRefreshToken()) {
      throw new Error("Token refresh not configured");
    }

    const authClient = new CloudAuthClient(this.environment!);
    const tokens = await authClient.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken!,
    });

    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;

    if (this.onTokenRefresh) {
      await this.onTokenRefresh(tokens);
    }
  }

  /**
   * Wraps an API call with automatic retry on 401 after token refresh.
   * If the call fails with 401 and token refresh is configured, refreshes the
   * token and retries the call once.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        this.canRefreshToken()
      ) {
        await this.refreshAccessToken();
        return fn();
      }
      throw error;
    }
  }

  /** Retrieves the current authenticated user. */
  async getCurrentUser(): Promise<UserResponse> {
    return this.withRetry(async () => {
      const { data } = await this.client.get<UserResponse>("/v1/users/me");
      return data;
    });
  }

  /** Retrieves all accounts the current user has a role in. */
  async getAccounts(): Promise<AccountListResponse> {
    return this.withRetry(async () => {
      const { data } = await this.client.get<AccountListResponse>(
        "/v1/accounts?has_user_role=true",
      );
      return data;
    });
  }

  /** Retrieves a single account by ID. */
  async getAccount(accountId: string): Promise<Account> {
    return this.withRetry(async () => {
      const { data } = await this.client.get<Account>(
        `/v1/accounts/${accountId}`,
      );
      return data;
    });
  }

  /** Fetches details for a content item by ID. */
  async getContent(contentId: ContentID): Promise<ContentResponse> {
    return this.withRetry(async () => {
      const { data } = await this.client.get<ContentResponse>(
        `/v1/contents/${contentId}`,
      );
      return data;
    });
  }

  /** Creates a new content item and returns the content response. */
  async createContent(request: CreateContentRequest): Promise<ContentResponse> {
    return this.withRetry(async () => {
      const { data } = await this.client.post<ContentResponse>(
        "/v1/contents",
        request,
      );
      return data;
    });
  }

  /** Updates an existing content item with new_bundle=true query parameter. */
  async updateContent(request: UpdateContentRequest): Promise<ContentResponse> {
    return this.withRetry(async () => {
      const { content_id, ...body } = request;
      const { data } = await this.client.patch<ContentResponse>(
        `/v1/contents/${content_id}?new_bundle=true`,
        body,
      );
      return data;
    });
  }

  /** Requests authorization for a resource. */
  async getAuthorization(
    request: AuthorizationRequest,
  ): Promise<AuthorizationResponse> {
    return this.withRetry(async () => {
      const { data } = await this.client.post<AuthorizationResponse>(
        "/v1/authorization",
        request,
      );
      return data;
    });
  }

  /** Retrieves a revision by ID. */
  async getRevision(revisionId: string): Promise<Revision> {
    return this.withRetry(async () => {
      const { data } = await this.client.get<Revision>(
        `/v1/revisions/${revisionId}`,
      );
      return data;
    });
  }

  /** Publishes a content item by ID. */
  async publishContent(contentId: ContentID): Promise<void> {
    return this.withRetry(async () => {
      await this.client.post(`/v1/contents/${contentId}/publish`);
    });
  }

  /**
   * Uploads a bundle to a pre-signed URL.
   * This does not use the authenticated client since the URL is pre-signed; it
   * goes through a dedicated `uploadClient` instance that follows redirects.
   *
   * The body is streamed from the staged bundle file so uploads of arbitrary
   * size never have to be buffered in memory. `contentLength` is already known
   * from writing that temp file to disk (its byte size), so we pass it here
   * rather than have axios try to derive it from the stream.
   *
   * `makeBody` is a factory that opens a fresh read stream from the bundle file
   * on disk. A stream can only be consumed once, so on each redirect hop the
   * redirect handler destroys the consumed stream and calls the factory again
   * for a new one — the bundle is re-streamed from disk, never buffered in
   * memory. S3-style presigned endpoints can themselves redirect (e.g. region
   * redirects), which is why this parity with the Connect client matters.
   */
  async uploadBundle(
    uploadUrl: string,
    makeBody: () => Readable,
    contentLength: number,
    signal?: AbortSignal,
  ): Promise<void> {
    // Track the live stream so each redirect hop can destroy the consumed one
    // before opening a fresh read from disk, and so the final stream is always
    // cleaned up even when the request fails or is aborted.
    let current: Readable | undefined;
    const bodyFactory = (): Readable => {
      current?.destroy();
      current = makeBody();
      return current;
    };
    try {
      await uploadClient.post(uploadUrl, bodyFactory(), {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Length": contentLength,
        },
        bodyFactory,
        signal,
      });
    } finally {
      // On success the stream is fully consumed; destroy() is then a no-op.
      current?.destroy();
    }
  }
}
