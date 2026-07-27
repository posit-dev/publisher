// Copyright (C) 2026 by Posit Software, PBC.

import { logger } from "src/logging";
import { createOAuthHttpClient } from "./httpClient";
import { OAuthMetadata } from "./types";

const WELL_KNOWN_PATH = "/.well-known/oauth-authorization-server";

/** Joins a server URL and a well-known path without doubling slashes. */
function wellKnownUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, "") + WELL_KNOWN_PATH;
}

/**
 * Type guard for the minimal RFC 8414 metadata Publisher requires: an object
 * carrying string `token_endpoint` and `authorization_endpoint`. Optional fields
 * on {@link OAuthMetadata} stay optional.
 */
function isOAuthMetadata(data: unknown): data is OAuthMetadata {
  return (
    typeof data === "object" &&
    data !== null &&
    "token_endpoint" in data &&
    typeof data.token_endpoint === "string" &&
    "authorization_endpoint" in data &&
    typeof data.authorization_endpoint === "string"
  );
}

/**
 * Probes a Connect server for OAuth 2.0 authorization-server metadata
 * (RFC 8414). Returns the parsed metadata only when the server responds 200
 * with a document that carries a `token_endpoint` (and `authorization_endpoint`,
 * which every flow needs). Returns `null` when OAuth is unavailable — a 404, a
 * non-JSON/HTML body (e.g. an auth proxy), a network/TLS failure, or metadata
 * missing the required endpoints — so callers can fall back to token/API-key
 * auth.
 *
 * Honors the TLS verification setting via `insecure`.
 */
export async function discoverOAuthMetadata(
  serverUrl: string,
  insecure: boolean,
): Promise<OAuthMetadata | null> {
  const url = wellKnownUrl(serverUrl);
  const client = createOAuthHttpClient(insecure);

  let status: number;
  let data: unknown;
  try {
    const resp = await client.get(url);
    status = resp.status;
    data = resp.data;
  } catch (err) {
    // Network/TLS failure — treat as "OAuth not available" and let the caller
    // fall back. The subsequent auth flow will surface any connectivity error.
    logger.debug(
      `OAuth discovery request failed for ${serverUrl}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }

  if (status !== 200) {
    logger.debug(`OAuth discovery returned HTTP ${status} for ${serverUrl}`);
    return null;
  }

  if (!isOAuthMetadata(data)) {
    logger.debug(
      `OAuth discovery response for ${serverUrl} is missing required endpoints`,
    );
    return null;
  }

  return data;
}
