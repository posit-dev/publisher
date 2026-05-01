// Copyright (C) 2026 by Posit Software, PBC.

import { ConnectAPI, ConnectAPIError } from "@posit-dev/connect-api";

import { listConnections } from "./connections";
import { createTokenProvider } from "./tokenProviders";
import { getListOfPossibleURLs } from "../utils/url";
import { logger } from "src/logging";
import type { SnowflakeConnection } from "./types";

const VALIDATION_TIMEOUT_MS = 30_000;

export interface SnowflakeDiscoveryAuth {
  apiKey?: string;
  token?: string;
  privateKey?: string;
}

/**
 * Discovers Snowflake connections that can successfully authenticate
 * to the Connect server at the given URL.
 */
export async function discoverSnowflakeConnections(
  serverUrl: string,
  connectAuth?: SnowflakeDiscoveryAuth,
): Promise<SnowflakeConnection[]> {
  const urlCandidates = getListOfPossibleURLs(serverUrl);
  const connections = listConnections();
  const results: SnowflakeConnection[] = [];

  for (const [name, config] of Object.entries(connections)) {
    let tokenProvider;
    try {
      tokenProvider = createTokenProvider(config);
    } catch (e) {
      logger.debug(`Snowflake: skipping connection "${name}": ${e}`);
      continue;
    }

    for (const candidateUrl of urlCandidates) {
      try {
        const hostname = new URL(candidateUrl).hostname;
        const token = await tokenProvider.getToken(hostname);

        const baseOpts = {
          url: candidateUrl,
          snowflakeToken: token,
          timeout: VALIDATION_TIMEOUT_MS,
        };

        const connectOpts =
          connectAuth?.token && connectAuth?.privateKey
            ? { token: connectAuth.token, privateKey: connectAuth.privateKey }
            : connectAuth?.apiKey
              ? { apiKey: connectAuth.apiKey }
              : {};

        const api = new ConnectAPI({
          ...baseOpts,
          ...connectOpts,
        });

        try {
          await api.testAuthentication();
        } catch (e) {
          // 401 means we got through the Snowflake proxy (good!) but
          // Connect rejected us (expected when no Connect auth yet).
          if (!(e instanceof ConnectAPIError && e.httpStatus === 401)) {
            throw e;
          }
        }

        results.push({ name, serverUrl: candidateUrl });
        // Stop trying other URLs for this connection
        break;
      } catch (e) {
        logger.debug(
          `Snowflake: connection "${name}" failed for ${candidateUrl}: ${e}`,
        );
        continue;
      }
    }
  }

  return results;
}
