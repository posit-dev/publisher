// Copyright (C) 2026 by Posit Software, PBC.

import snowflake from "snowflake-sdk";

import type { SnowflakeConnectionConfig } from "./types";

/**
 * Obtains a session token from Snowflake using the authenticator and credentials
 * from the connection config. Supports "snowflake_jwt", "oauth", and "externalbrowser"
 * authenticators (case-insensitive).
 *
 * The session token is extracted directly from the SDK's internal connection state.
 * Do NOT call conn.destroy() — it invalidates the token.
 */
export async function getSnowflakeToken(
  connection: SnowflakeConnectionConfig,
): Promise<string> {
  const authenticator = connection.authenticator.toUpperCase();

  let connectionConfig: Record<string, unknown>;

  switch (authenticator) {
    case "SNOWFLAKE_JWT": {
      if (!connection.private_key_file) {
        throw new Error("private_key_file is required for snowflake_jwt");
      }
      connectionConfig = {
        username: connection.user,
        authenticator,
        privateKeyPath: connection.private_key_file,
      };
      break;
    }
    case "OAUTH": {
      if (!connection.token) {
        throw new Error("token is required for oauth");
      }
      connectionConfig = {
        authenticator,
        token: connection.token,
      };
      break;
    }
    case "EXTERNALBROWSER":
      connectionConfig = {
        username: connection.user,
        authenticator,
      };
      break;
    default:
      throw new Error(
        `unsupported authenticator type: "${connection.authenticator}"`,
      );
  }

  const conn = snowflake.createConnection({
    account: connection.account,
    clientStoreTemporaryCredential: true,
    ...connectionConfig,
  });

  await conn.connectAsync();

  const sessionToken = extractSerializedToken(JSON.parse(conn.serialize()));

  if (!sessionToken || typeof sessionToken !== "string") {
    throw new Error(
      `missing session token in ${authenticator.toLowerCase()} connection state`,
    );
  }

  return sessionToken;
}

/**
 * Extracts the session token from the private state returned by
 * connection.serialize(). This is an undocumented SDK internal; the SDK is
 * pinned to avoid breakage from internal restructuring.
 */
function extractSerializedToken(parsed: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (parsed as any)?.services?.sf?.tokenInfo?.sessionToken;
}
