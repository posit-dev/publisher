// Copyright (C) 2026 by Posit Software, PBC.

import axios from "axios";
import type { AxiosInstance } from "axios";

import type {
  Account,
  AccountListResponse,
  AuthorizationRequest,
  AuthorizationResponse,
  ConnectCloudAPIOptions,
  ContentID,
  ContentResponse,
  CreateContentRequest,
  Revision,
  UpdateContentRequest,
  UserResponse,
} from "./types.js";

/**
 * TypeScript client for the Posit Connect Cloud API.
 *
 * Uses axios for HTTP requests. Non-2xx responses throw AxiosError by default.
 * Property names use snake_case to match the Connect Cloud API JSON wire format.
 */
export class ConnectCloudAPI {
  private readonly client: AxiosInstance;

  constructor(options: ConnectCloudAPIOptions) {
    this.client = axios.create({
      baseURL: options.apiBaseUrl,
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
      },
    });
  }

  /** Retrieves the current authenticated user. */
  async getCurrentUser(): Promise<UserResponse> {
    const { data } = await this.client.get<UserResponse>("/v1/users/me");
    return data;
  }

  /** Retrieves all accounts the current user has a role in. */
  async getAccounts(): Promise<AccountListResponse> {
    const { data } = await this.client.get<AccountListResponse>(
      "/v1/accounts?has_user_role=true",
    );
    return data;
  }

  /** Retrieves a single account by ID. */
  async getAccount(accountId: string): Promise<Account> {
    const { data } = await this.client.get<Account>(
      `/v1/accounts/${accountId}`,
    );
    return data;
  }

  /** Fetches details for a content item by ID. */
  async getContent(contentId: ContentID): Promise<ContentResponse> {
    const { data } = await this.client.get<ContentResponse>(
      `/v1/contents/${contentId}`,
    );
    return data;
  }

  /** Creates a new content item and returns the content response. */
  async createContent(request: CreateContentRequest): Promise<ContentResponse> {
    const { data } = await this.client.post<ContentResponse>(
      "/v1/contents",
      request,
    );
    return data;
  }

  /** Updates an existing content item with new_bundle=true query parameter. */
  async updateContent(request: UpdateContentRequest): Promise<ContentResponse> {
    const { content_id, ...body } = request;
    const { data } = await this.client.patch<ContentResponse>(
      `/v1/contents/${content_id}?new_bundle=true`,
      body,
    );
    return data;
  }

  /** Requests authorization for a resource. */
  async getAuthorization(
    request: AuthorizationRequest,
  ): Promise<AuthorizationResponse> {
    const { data } = await this.client.post<AuthorizationResponse>(
      "/v1/authorization",
      request,
    );
    return data;
  }

  /** Retrieves a revision by ID. */
  async getRevision(revisionId: string): Promise<Revision> {
    const { data } = await this.client.get<Revision>(
      `/v1/revisions/${revisionId}`,
    );
    return data;
  }

  /** Publishes a content item by ID. */
  async publishContent(contentId: string): Promise<void> {
    await this.client.post(`/v1/contents/${contentId}/publish`);
  }

  /**
   * Uploads a bundle to a pre-signed URL.
   * This does not use the authenticated client since the URL is pre-signed.
   */
  async uploadBundle(uploadUrl: string, bundle: Uint8Array): Promise<void> {
    await axios.post(uploadUrl, bundle, {
      headers: { "Content-Type": "application/gzip" },
    });
  }
}
