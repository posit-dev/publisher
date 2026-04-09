// Copyright (C) 2026 by Posit Software, PBC.

import { ConnectAPI } from "@posit-dev/connect-api";

import { listConnections } from "./connections";
import { createTokenProvider } from "./tokenProviders";
import { getListOfPossibleURLs } from "../utils/url";
import type { SnowflakeConnection } from "./types";

const VALIDATION_TIMEOUT_MS = 30_000;

/**
 * Discovers Snowflake connections that can successfully authenticate
 * to the Connect server at the given URL.
 */
export async function discoverSnowflakeConnections(
  serverUrl: string,
): Promise<SnowflakeConnection[]> {
  const urlCandidates = getListOfPossibleURLs(serverUrl);
  const connections = listConnections();
  const results: SnowflakeConnection[] = [];

  for (const [name, config] of Object.entries(connections)) {
    let tokenProvider;
    try {
      tokenProvider = createTokenProvider(config);
    } catch {
      // Skip connections with invalid config (e.g., missing key file)
      continue;
    }

    for (const candidateUrl of urlCandidates) {
      try {
        const hostname = new URL(candidateUrl).hostname;
        const token = await tokenProvider.getToken(hostname);

        const api = new ConnectAPI({
          url: candidateUrl,
          snowflakeToken: token,
          timeout: VALIDATION_TIMEOUT_MS,
        });

        await api.testAuthentication();

        results.push({ name, serverUrl: candidateUrl });
        // Stop trying other URLs for this connection
        break;
      } catch {
        // Try next URL candidate
        continue;
      }
    }
  }

  return results;
}
