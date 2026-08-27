// Copyright (C) 2026 by Posit Software, PBC.

import https from "https";
import type { ClientRequest, IncomingMessage } from "http";
import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { getUserAgent } from "src/utils/userAgent";

/** Request timeout for OAuth endpoints (ms). */
export const OAUTH_TIMEOUT_MS = 30_000;

/**
 * Builds an axios instance for talking to Connect's OAuth endpoints, honoring
 * the extension's TLS verification setting.
 *
 * When `insecure` is true this both installs a permissive https.Agent and a
 * per-request transport that forces `rejectUnauthorized: false` — the same
 * two-pronged approach `@posit-dev/connect-api`'s client uses, because VS Code's
 * proxy patch discards the Agent option on its own.
 */
export function createOAuthHttpClient(insecure: boolean): AxiosInstance {
  const config: AxiosRequestConfig = {
    timeout: OAUTH_TIMEOUT_MS,
    // Never throw on non-2xx — OAuth error responses (400/401) carry meaningful
    // JSON bodies (e.g. `authorization_pending`, `invalid_client`) that callers
    // must inspect.
    validateStatus: () => true,
    headers: { "User-Agent": getUserAgent() },
  };

  if (insecure) {
    config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    config.transport = {
      request: (
        reqOptions: https.RequestOptions,
        callback: (res: IncomingMessage) => void,
      ): ClientRequest =>
        https.request({ ...reqOptions, rejectUnauthorized: false }, callback),
    };
  }

  return axios.create(config);
}
