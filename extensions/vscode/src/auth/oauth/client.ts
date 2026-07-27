// Copyright (C) 2026 by Posit Software, PBC.

import type { AxiosInstance } from "axios";
import { createOAuthHttpClient } from "./httpClient";
import {
  ClientRegistration,
  DeviceAuthResponse,
  OAuthMetadata,
  OAuthTokenResponse,
  OAUTH_CLIENT_NAME,
} from "./types";

// OAuth error codes we branch on (RFC 6749 / RFC 7591 / RFC 8628).
export const INVALID_CLIENT = "invalid_client";
export const AUTHORIZATION_PENDING = "authorization_pending";
export const SLOW_DOWN = "slow_down";
export const EXPIRED_TOKEN = "expired_token";
export const ACCESS_DENIED = "access_denied";

const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

/** An error returned by a Connect OAuth endpoint. */
export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

function isTokenResponse(data: unknown): data is OAuthTokenResponse {
  return (
    isRecord(data) &&
    typeof data.access_token === "string" &&
    typeof data.token_type === "string"
  );
}

function isClientRegistration(data: unknown): data is ClientRegistration {
  return isRecord(data) && typeof data.client_id === "string";
}

function isDeviceAuthResponse(data: unknown): data is DeviceAuthResponse {
  return (
    isRecord(data) &&
    typeof data.device_code === "string" &&
    typeof data.user_code === "string" &&
    typeof data.verification_uri === "string" &&
    typeof data.expires_in === "number"
  );
}

/** Builds an {@link OAuthError} from an endpoint's `{ error, error_description }`. */
function toOAuthError(
  status: number,
  data: unknown,
  fallback: string,
): OAuthError {
  if (isRecord(data)) {
    const code = typeof data.error === "string" ? data.error : undefined;
    const description =
      typeof data.error_description === "string"
        ? data.error_description
        : undefined;
    return new OAuthError(description ?? code ?? fallback, code, status);
  }
  return new OAuthError(fallback, undefined, status);
}

function ok(status: number): boolean {
  return status >= 200 && status < 300;
}

/** Result of a single device-token poll. */
export type DevicePollResult =
  | { done: false; slowDown: boolean }
  | { done: true; response: OAuthTokenResponse };

/**
 * Client for Connect's OAuth 2.0 authorization server. Mirrors the mechanism in
 * rsconnect-python's `rsconnect/oauth.py`: RFC 7591 dynamic client registration,
 * Authorization Code + PKCE, RFC 8628 device flow, and refresh-token exchange.
 * All requests honor the TLS verification setting via `insecure`.
 */
export class OAuthClient {
  private readonly http: AxiosInstance;

  constructor(insecure: boolean) {
    this.http = createOAuthHttpClient(insecure);
  }

  /**
   * Registers a public OAuth client with Connect (RFC 7591). Connect derives a
   * deterministic, secret-less `client_id` from the client name + redirect URIs.
   */
  async registerClient(
    metadata: OAuthMetadata,
    redirectUris: string[],
  ): Promise<ClientRegistration> {
    if (!metadata.registration_endpoint) {
      throw new OAuthError(
        "This Connect server does not advertise OAuth dynamic client registration.",
      );
    }
    // Only advertise the device-code grant when the server supports it, matching
    // rsconnect-python (rsconnect/oauth.py register_client). A strict RFC 7591
    // server may reject an unsupported grant type.
    const grantTypes = ["authorization_code", "refresh_token"];
    if (metadata.device_authorization_endpoint) {
      grantTypes.push(DEVICE_CODE_GRANT);
    }
    const resp = await this.http.post(
      metadata.registration_endpoint,
      {
        client_name: OAUTH_CLIENT_NAME,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: grantTypes,
        response_types: ["code"],
      },
      { headers: { "Content-Type": "application/json" } },
    );
    if (!ok(resp.status) || !isClientRegistration(resp.data)) {
      throw toOAuthError(
        resp.status,
        resp.data,
        "Failed to register an OAuth client with Connect.",
      );
    }
    return resp.data;
  }

  /**
   * Builds the authorization-request URL for the Authorization Code + PKCE flow.
   */
  buildAuthorizeUrl(
    metadata: OAuthMetadata,
    params: {
      clientId: string;
      redirectUri: string;
      codeChallenge: string;
      state: string;
    },
  ): string {
    const url = new URL(metadata.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  /** Exchanges an authorization code (+ PKCE verifier) for tokens. */
  exchangeAuthCode(
    metadata: OAuthMetadata,
    params: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
      clientId: string;
    },
  ): Promise<OAuthTokenResponse> {
    return this.tokenRequest(
      metadata,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: params.clientId,
        code_verifier: params.codeVerifier,
      }),
    );
  }

  /** Exchanges a refresh token for a fresh access token (RFC 6749 §6). */
  refreshToken(
    metadata: OAuthMetadata,
    params: { clientId: string; refreshToken: string },
  ): Promise<OAuthTokenResponse> {
    return this.tokenRequest(
      metadata,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: params.clientId,
        refresh_token: params.refreshToken,
      }),
    );
  }

  /** Starts the RFC 8628 device authorization flow. */
  async startDeviceAuth(
    metadata: OAuthMetadata,
    clientId: string,
  ): Promise<DeviceAuthResponse> {
    if (!metadata.device_authorization_endpoint) {
      throw new OAuthError(
        "This Connect server does not advertise the OAuth device flow.",
      );
    }
    const resp = await this.http.post(
      metadata.device_authorization_endpoint,
      new URLSearchParams({ client_id: clientId }).toString(),
      { headers: FORM_HEADERS },
    );
    if (!ok(resp.status) || !isDeviceAuthResponse(resp.data)) {
      throw toOAuthError(
        resp.status,
        resp.data,
        "Failed to start OAuth device authorization.",
      );
    }
    return resp.data;
  }

  /**
   * Performs a single device-token poll. Returns `{ done: false }` while the
   * user has not yet authorized (`authorization_pending`, or `slow_down` which
   * asks the caller to back off), `{ done: true, response }` once tokens are
   * issued, and throws {@link OAuthError} on a terminal error (`expired_token`,
   * `access_denied`, `invalid_client`, …).
   */
  async pollDeviceToken(
    metadata: OAuthMetadata,
    params: { clientId: string; deviceCode: string },
  ): Promise<DevicePollResult> {
    const resp = await this.http.post(
      metadata.token_endpoint,
      new URLSearchParams({
        grant_type: DEVICE_CODE_GRANT,
        device_code: params.deviceCode,
        client_id: params.clientId,
      }).toString(),
      { headers: FORM_HEADERS },
    );
    if (ok(resp.status) && isTokenResponse(resp.data)) {
      return { done: true, response: resp.data };
    }
    const err = toOAuthError(
      resp.status,
      resp.data,
      "Device authorization failed.",
    );
    if (err.code === AUTHORIZATION_PENDING) {
      return { done: false, slowDown: false };
    }
    if (err.code === SLOW_DOWN) {
      return { done: false, slowDown: true };
    }
    throw err;
  }

  private async tokenRequest(
    metadata: OAuthMetadata,
    body: URLSearchParams,
  ): Promise<OAuthTokenResponse> {
    const resp = await this.http.post(
      metadata.token_endpoint,
      body.toString(),
      {
        headers: FORM_HEADERS,
      },
    );
    if (!ok(resp.status) || !isTokenResponse(resp.data)) {
      throw toOAuthError(resp.status, resp.data, "OAuth token request failed.");
    }
    return resp.data;
  }
}

/**
 * Computes an ISO-8601 expiry timestamp from a token response's `expires_in`
 * (seconds from now), or "" when the server did not provide one.
 */
export function tokenExpiresAt(response: OAuthTokenResponse): string {
  if (typeof response.expires_in !== "number") {
    return "";
  }
  return new Date(Date.now() + response.expires_in * 1000).toISOString();
}
