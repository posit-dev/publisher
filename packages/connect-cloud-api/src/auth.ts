// Copyright (C) 2026 by Posit Software, PBC.

import axios from "axios";

import {
  CloudEnvironment,
  cloudAuthBaseUrls,
  cloudAuthClientIds,
} from "./types.js";
import type { TokenRequest, TokenResponse } from "./types.js";

const AUTH_SCOPE = "vivid";

/**
 * Client for Posit Cloud OAuth endpoints (login.posit.cloud).
 *
 * Used for token refresh when the access token expires.
 */
export class CloudAuthClient {
  private readonly baseUrl: string;
  private readonly clientId: string;

  constructor(environment: CloudEnvironment) {
    this.baseUrl = cloudAuthBaseUrls[environment];
    this.clientId = cloudAuthClientIds[environment];
  }

  /**
   * Exchanges a refresh token for a new access token.
   *
   * POST /oauth/token with form-urlencoded body.
   */
  async exchangeToken(request: TokenRequest): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: request.grant_type,
      client_id: this.clientId,
      scope: AUTH_SCOPE,
      refresh_token: request.refresh_token,
    });

    const { data } = await axios.post<TokenResponse>(
      `${this.baseUrl}/oauth/token`,
      body,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    return data;
  }
}
