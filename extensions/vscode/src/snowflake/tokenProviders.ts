// Copyright (C) 2026 by Posit Software, PBC.

import snowflake from "snowflake-sdk";

import type { SnowflakeConnectionConfig } from "./types";

/** A token provider that returns an ingress access token for a given hostname. */
export interface TokenProvider {
  getToken(hostname: string): Promise<string>;
}

/**
 * Creates a TokenProvider based on the authenticator field of the connection config.
 * Supported authenticators: "snowflake_jwt", "oauth", "externalbrowser" (case-insensitive).
 */
export function createTokenProvider(
  connection: SnowflakeConnectionConfig,
): TokenProvider {
  const authenticator = connection.authenticator.toLowerCase();

  switch (authenticator) {
    case "snowflake_jwt":
      return new JWTTokenProvider(connection);
    case "oauth":
      return new OAuthTokenProvider(connection);
    case "externalbrowser":
      return new ExternalBrowserTokenProvider(connection);
    default:
      throw new Error(
        `unsupported authenticator type: "${connection.authenticator}"`,
      );
  }
}

/**
 * JWT token provider that uses key-pair authentication with Snowflake SDK.
 * Uses the snowflake-sdk with SNOWFLAKE_JWT authenticator to obtain a session token.
 */
class JWTTokenProvider implements TokenProvider {
  private readonly account: string;
  private readonly user: string;
  private readonly privateKeyPath: string;

  constructor(connection: SnowflakeConnectionConfig) {
    const keyFile = connection.private_key_file;
    if (!keyFile) {
      throw new Error("private_key_file is required for snowflake_jwt");
    }

    this.account = connection.account;
    this.user = connection.user;
    this.privateKeyPath = keyFile;
  }

  async getToken(_hostname: string): Promise<string> {
    const conn = snowflake.createConnection({
      account: this.account,
      username: this.user,
      authenticator: "SNOWFLAKE_JWT",
      privateKeyPath: this.privateKeyPath,
      clientStoreTemporaryCredential: true,
    });

    await conn.connectAsync();

    const sessionToken = extractSerializedToken(JSON.parse(conn.serialize()));

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new Error("missing session token in jwt connection state");
    }

    // Do NOT call conn.destroy() — it sends a logout request to the server
    // and invalidates the session token we just extracted.

    return sessionToken;
  }
}

/**
 * OAuth token provider that uses Snowflake's OAuth authentication.
 * Uses the snowflake-sdk with OAUTH authenticator to obtain a session token.
 */
class OAuthTokenProvider implements TokenProvider {
  private readonly account: string;
  private readonly token: string;

  constructor(connection: SnowflakeConnectionConfig) {
    const oauthToken = connection.token;
    if (!oauthToken) {
      throw new Error("token is required for oauth");
    }

    this.account = connection.account;
    this.token = oauthToken;
  }

  async getToken(_hostname: string): Promise<string> {
    const conn = snowflake.createConnection({
      account: this.account,
      authenticator: "OAUTH",
      token: this.token,
      clientStoreTemporaryCredential: true,
    });

    await conn.connectAsync();

    const sessionToken = extractSerializedToken(JSON.parse(conn.serialize()));

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new Error("missing session token in oauth connection state");
    }

    // Do NOT call conn.destroy() — it sends a logout request to the server
    // and invalidates the session token we just extracted.

    return sessionToken;
  }
}

/**
 * External browser token provider that uses Snowflake's browser-based SSO.
 * Opens the system browser for the user to authenticate via their identity provider,
 * then extracts the session token from the SDK's internal connection state.
 */
class ExternalBrowserTokenProvider implements TokenProvider {
  private readonly account: string;
  private readonly user: string;

  constructor(connection: SnowflakeConnectionConfig) {
    this.account = connection.account;
    this.user = connection.user;
  }

  async getToken(_hostname: string): Promise<string> {
    const conn = snowflake.createConnection({
      account: this.account,
      username: this.user,
      authenticator: "EXTERNALBROWSER",
      clientStoreTemporaryCredential: true,
    });

    await conn.connectAsync();

    const sessionToken = extractSerializedToken(JSON.parse(conn.serialize()));

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new Error(
        "missing session token in externalbrowser connection state",
      );
    }

    // Do NOT call conn.destroy() — it sends a logout request to the server
    // and invalidates the session token we just extracted.

    return sessionToken;
  }
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
