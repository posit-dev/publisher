// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";
import { createHash, randomUUID } from "crypto";
import { GUID, ConnectAPIOptions } from "@posit-dev/connect-api";
import { Mutex } from "async-mutex";
import snowflake from "snowflake-sdk";

import { Credential } from "src/api/types/credentials";
import { ServerType } from "src/api/types/contentRecords";
import type { SnowflakeConnectionConfig } from "src/snowflake/types";
import {
  getAllCredentials,
  getCredential,
  storeCredential,
  deleteCredential,
  deleteAllCredentials,
} from "./storage";
import { listConnections } from "src/snowflake/connections";
import { normalizeServerURL, isConnectLike } from "src/utils/serverUrl";
import {
  CredentialNotFoundError,
  CredentialNameCollisionError,
  CredentialIdentityCollisionError,
  IncompleteCredentialError,
} from "./errors";
import { CONNECT_CLOUD_ENV } from "src/constants";
import config from "src/config";
import { logger } from "src/logging";
import {
  discoverOAuthMetadata,
  OAuthClient,
  OAuthError,
  INVALID_CLIENT,
  tokenExpiresAt,
  OAUTH_LOOPBACK_REDIRECT,
} from "src/auth/oauth";

// Upper bound on how long to wait for snowflake-sdk's destroy() callback before
// giving up. destroy() is async and, on a wedged connection, may never invoke
// its callback; without a bound it would hold the connection-cache mutex
// indefinitely and stall every other token fetch.
export const SNOWFLAKE_DESTROY_TIMEOUT_MS = 5_000;

export interface CreateCredentialInput {
  name: string;
  url?: string;
  serverType: ServerType;
  apiKey?: string;
  snowflakeConnection?: string;
  accountId?: string;
  accountName?: string;
  refreshToken?: string;
  accessToken?: string;
  token?: string;
  privateKey?: string;
  oauthClientId?: string;
  tokenExpiresAt?: string;
}

/**
 * Build a ConnectAPIOptions discriminated union from a stored Credential.
 * Picks the correct auth variant (ApiKeyAuth, TokenAuth, SnowflakeAuth, or
 * NoAuth) based on which fields are present on the credential (empty string = absent).
 *
 * For Snowflake credentials, generates a fresh token by loading the named
 * connection from connections.toml and exchanging credentials with Snowflake.
 */
export async function connectAPIOptionsFromCredential(
  service: CredentialsService,
  credential: Pick<
    Credential,
    | "guid"
    | "url"
    | "apiKey"
    | "token"
    | "privateKey"
    | "serverType"
    | "snowflakeConnection"
    | "accessToken"
    | "refreshToken"
    | "oauthClientId"
  >,
  extra?: Pick<ConnectAPIOptions, "rejectUnauthorized" | "timeout">,
): Promise<ConnectAPIOptions> {
  if (
    credential.serverType === ServerType.SNOWFLAKE &&
    credential.snowflakeConnection
  ) {
    return await service.buildSnowflakeOptions(credential, extra);
  }

  // OAuth bearer credential. The refresh callback is invoked by the client on a
  // 401: it refreshes the access token (re-registering the client if Connect
  // reports it as deleted), persists the rotated tokens back to SecretStorage,
  // and returns the new access token for a single retry. If refresh fails the
  // client surfaces a SessionExpiredError for the caller to prompt re-auth.
  if (credential.oauthClientId && credential.accessToken) {
    const insecure = extra?.rejectUnauthorized === false;
    return {
      url: credential.url,
      accessToken: credential.accessToken,
      refreshAccessToken: () =>
        service.refreshOAuthToken(
          {
            guid: credential.guid,
            url: credential.url,
            oauthClientId: credential.oauthClientId,
            refreshToken: credential.refreshToken,
          },
          insecure,
        ),
      ...extra,
    };
  }

  if (credential.token && credential.privateKey) {
    return {
      url: credential.url,
      token: credential.token,
      privateKey: credential.privateKey,
      ...extra,
    };
  }
  if (credential.apiKey) {
    return {
      url: credential.url,
      apiKey: credential.apiKey,
      ...extra,
    };
  }
  return {
    url: credential.url,
    ...extra,
  };
}

export class CredentialsService {
  private snowflakeConnectionCache = new Map<string, snowflake.Connection>();
  private snowflakeConnectionCacheMutex = new Mutex();

  constructor(private readonly secrets: SecretStorage) {}

  list(): Promise<Credential[]> {
    return getAllCredentials(this.secrets);
  }

  async get(guid: GUID): Promise<Credential> {
    const cred = await getCredential(this.secrets, guid);
    if (!cred) {
      throw new CredentialNotFoundError(guid);
    }
    return cred;
  }

  async create(input: CreateCredentialInput): Promise<Credential> {
    const connectPresent = Boolean(input.apiKey);
    const snowflakePresent = Boolean(input.snowflakeConnection);
    const connectCloudPresent =
      Boolean(input.accountId) &&
      Boolean(input.accountName) &&
      Boolean(input.refreshToken) &&
      Boolean(input.accessToken);
    const tokenAuthPresent = Boolean(input.token) && Boolean(input.privateKey);
    const oauthPresent =
      Boolean(input.oauthClientId) && Boolean(input.accessToken);

    switch (input.serverType) {
      case ServerType.CONNECT: {
        // Exactly one of API key / token+key / OAuth, and no Snowflake or Cloud
        // fields.
        const connectMethods = [
          connectPresent,
          tokenAuthPresent,
          oauthPresent,
        ].filter(Boolean).length;
        if (connectMethods !== 1 || snowflakePresent || connectCloudPresent) {
          throw new IncompleteCredentialError(
            "Connect credential requires exactly one of: an API Key, Token+PrivateKey, or OAuth",
          );
        }
        break;
      }
      case ServerType.SNOWFLAKE:
        if (
          !snowflakePresent ||
          (connectPresent && tokenAuthPresent) ||
          (!connectPresent && !tokenAuthPresent) ||
          oauthPresent ||
          connectCloudPresent
        ) {
          throw new IncompleteCredentialError(
            "Snowflake credential requires a Snowflake connection and either an API Key or Token+PrivateKey (but not both)",
          );
        }
        break;
      case ServerType.CONNECT_CLOUD:
        if (
          !connectCloudPresent ||
          connectPresent ||
          snowflakePresent ||
          tokenAuthPresent ||
          Boolean(input.oauthClientId)
        ) {
          throw new IncompleteCredentialError(
            "Connect Cloud credential requires accountId, accountName, refreshToken, and accessToken",
          );
        }
        break;
      default:
        throw new IncompleteCredentialError(
          `Unsupported server type: ${input.serverType}`,
        );
    }

    // For cloud credentials, derive the URL from the cloud environment
    let url: string;
    if (input.serverType === ServerType.CONNECT_CLOUD) {
      url = config.connectCloudURL;
    } else {
      if (!input.url) {
        throw new IncompleteCredentialError("Credential requires a URL");
      }
      url = input.url;
    }

    if (!input.name) {
      throw new IncompleteCredentialError("Credential requires a name");
    }

    const normalizedUrl = normalizeServerURL(url);

    const cred: Credential = {
      guid: GUID(randomUUID()),
      name: input.name,
      url: normalizedUrl,
      serverType: input.serverType,
      apiKey: input.apiKey || "",
      snowflakeConnection: input.snowflakeConnection || "",
      accountId: input.accountId || "",
      accountName: input.accountName || "",
      refreshToken: input.refreshToken || "",
      accessToken: input.accessToken || "",
      cloudEnvironment:
        input.serverType === ServerType.CONNECT_CLOUD ? CONNECT_CLOUD_ENV : "",
      token: input.token || "",
      privateKey: input.privateKey || "",
      oauthClientId: input.oauthClientId || "",
      tokenExpiresAt: input.tokenExpiresAt || "",
    };

    // Conflict check against existing credentials
    const existing = await this.list();
    for (const c of existing) {
      this.conflictCheck(c, cred);
    }

    await storeCredential(this.secrets, cred);

    return cred;
  }

  async delete(guid: GUID): Promise<void> {
    const cred = await getCredential(this.secrets, guid);
    if (!cred) {
      throw new CredentialNotFoundError(guid);
    }
    await deleteCredential(this.secrets, guid);
  }

  /**
   * Merges a partial update into an existing credential (by GUID) and persists
   * it. Used to write back rotated OAuth tokens without disturbing the rest of
   * the record. `guid` and `serverType` cannot be changed.
   */
  async update(
    guid: GUID,
    patch: Partial<Omit<Credential, "guid" | "serverType">>,
  ): Promise<Credential> {
    const cred = await getCredential(this.secrets, guid);
    if (!cred) {
      throw new CredentialNotFoundError(guid);
    }
    const updated: Credential = { ...cred, ...patch, guid: cred.guid };
    await storeCredential(this.secrets, updated);
    return updated;
  }

  /**
   * Refreshes a Connect OAuth access token using the stored refresh token and
   * persists the rotated tokens (Connect issues single-use refresh tokens, so
   * the new refresh token must be saved). If Connect reports the client id as
   * `invalid_client` (deleted server-side), the public client is re-registered
   * — its id is deterministic — and the refresh is retried. Returns the fresh
   * access token. Throws when discovery or refresh ultimately fails; the caller
   * (the ConnectAPI client) surfaces that as a re-authentication prompt.
   */
  async refreshOAuthToken(
    credential: Pick<Credential, "guid" | "url" | "oauthClientId"> & {
      refreshToken: string;
    },
    insecure: boolean,
  ): Promise<string> {
    const metadata = await discoverOAuthMetadata(credential.url, insecure);
    if (!metadata) {
      throw new Error(
        "Connect no longer advertises OAuth; please sign in again.",
      );
    }

    const oauthClient = new OAuthClient(insecure);
    let clientId = credential.oauthClientId;

    let response;
    try {
      response = await oauthClient.refreshToken(metadata, {
        clientId,
        refreshToken: credential.refreshToken,
      });
    } catch (err) {
      if (!(err instanceof OAuthError) || err.code !== INVALID_CLIENT) {
        throw err;
      }
      // Client id was deleted on the server; re-register (deterministic id) and
      // retry the refresh once.
      const registration = await oauthClient.registerClient(metadata, [
        OAUTH_LOOPBACK_REDIRECT,
      ]);
      clientId = registration.client_id;
      response = await oauthClient.refreshToken(metadata, {
        clientId,
        refreshToken: credential.refreshToken,
      });
    }

    await this.update(credential.guid, {
      oauthClientId: clientId,
      accessToken: response.access_token,
      // Connect rotates refresh tokens (single-use); persist the new one when
      // provided, otherwise keep the current token.
      refreshToken: response.refresh_token || credential.refreshToken,
      tokenExpiresAt: tokenExpiresAt(response),
    });

    return response.access_token;
  }

  async reset(): Promise<void> {
    logger.warn("Resetting all credentials");
    await deleteAllCredentials(this.secrets);
  }

  private conflictCheck(existing: Credential, newCred: Credential): void {
    if (newCred.serverType === ServerType.CONNECT_CLOUD) {
      if (
        existing.serverType === ServerType.CONNECT_CLOUD &&
        existing.accountId === newCred.accountId &&
        existing.cloudEnvironment === newCred.cloudEnvironment
      ) {
        throw new CredentialIdentityCollisionError(
          existing.name,
          existing.url,
          existing.accountName,
        );
      }
    } else {
      if (isConnectLike(existing.serverType) && existing.url === newCred.url) {
        throw new CredentialIdentityCollisionError(
          existing.name,
          existing.url,
          existing.accountName,
        );
      }
    }
    if (newCred.name === existing.name) {
      throw new CredentialNameCollisionError(existing.name, existing.url);
    }
  }

  private getCacheKeyForConnection(
    connection: SnowflakeConnectionConfig,
  ): string {
    // Account and user are case-insensitive Snowflake identifiers;
    // authenticator and role are matched case-insensitively by the SDK.
    // Normalize them so equivalent configs share one cached connection.
    const account = connection.account.trim().toLowerCase();
    const user = (connection.user ?? "").trim().toLowerCase();
    const authenticator = connection.authenticator.trim().toUpperCase();
    const role = (connection.role ?? "").trim().toUpperCase();

    // token (oauth) and private_key_file (jwt) are the distinguishing
    // credential material. They must be part of the key so a rotated token or
    // a different key file produces a fresh connection rather than reusing a
    // stale one — but they are hashed so a secret never lands in a log line.
    //
    // NUL separates the fields: it can't appear in a token or a filesystem
    // path, so distinct field pairs can't collide into the same digest.
    //
    // We aren't hashing the key file, so if somebody changes their key in
    // place during a session, we will keep using the connection established
    // with the old key until that session goes invalid (or the extension
    // restarts). This is a pretty edge case.
    const credentialDigest = createHash("sha256")
      .update(connection.token ?? "")
      .update("\u0000")
      .update(connection.private_key_file ?? "")
      .digest("hex");

    return [account, user, authenticator, role, credentialDigest].join("|");
  }

  private createSnowflakeConnection(
    connection: SnowflakeConnectionConfig,
  ): snowflake.Connection {
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

    return snowflake.createConnection({
      account: connection.account,
      // Avoids repeated browser prompts by caching the SSO id-token in the
      // credential manager. Currently a (harmless) no-op for JWT/OAUTH.
      clientStoreTemporaryCredential: true,
      // Authenticate under the configured role when one is set; otherwise the
      // session uses the user's default role. Applies to every authenticator.
      ...(connection.role ? { role: connection.role } : {}),
      ...connectionConfig,
    });
  }

  /**
   * Destroys a Snowflake connection, resolving once the SDK reports completion
   * or {@link SNOWFLAKE_DESTROY_TIMEOUT_MS} elapses — whichever comes first.
   * Never rejects: destroy is best-effort cleanup of an already-invalid
   * connection, so a failure or hang is logged and swallowed rather than
   * propagated to the caller (who is about to rebuild the connection anyway).
   */
  private destroyConnection(
    conn: snowflake.Connection,
    cacheKey: string,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        logger.debug(
          `Timed out destroying invalid Snowflake connection for ${cacheKey}`,
        );
        finish();
      }, SNOWFLAKE_DESTROY_TIMEOUT_MS);

      try {
        conn.destroy((err) => {
          if (err) {
            logger.debug(
              `Error destroying invalid Snowflake connection for ${cacheKey}: ${err.message}`,
            );
          } else {
            logger.debug(
              `Destroyed invalid Snowflake connection for ${cacheKey}`,
            );
          }
          finish();
        });
      } catch (err) {
        // destroy() threw synchronously rather than reporting via callback.
        logger.debug(
          `Error destroying invalid Snowflake connection for ${cacheKey}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        finish();
      }
    });
  }

  private getOrCreateSnowflakeConnection(
    connection: SnowflakeConnectionConfig,
  ): Promise<snowflake.Connection> {
    const cacheKey = this.getCacheKeyForConnection(connection);

    return this.snowflakeConnectionCacheMutex.runExclusive(async () => {
      // Check cache
      const cached = this.snowflakeConnectionCache.get(cacheKey);
      if (cached) {
        let isValid = false;
        try {
          // NOTE: this potentially refreshes an expired session token using the
          // master token, and sends a heartbeat request to Snowflake. Do not
          // replace with isUp or isTokenValid. Always reread the session token
          // after this (see getSnowflakeToken) to pick up the refreshed value.
          isValid = await cached.isValidAsync();
        } catch (err) {
          // A validity check that throws (e.g. a network error during the
          // heartbeat) means we can't trust the cached connection. Treat it as
          // invalid and rebuild rather than leaving a poisoned entry behind.
          logger.debug(
            `Error validating cached Snowflake connection for ${cacheKey}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }

        if (isValid) {
          logger.debug(`Snowflake connection cache hit for ${cacheKey}`);
          return cached;
        }

        // Connection is no longer valid - destroy it and remove from cache
        await this.destroyConnection(cached, cacheKey);
        this.snowflakeConnectionCache.delete(cacheKey);
      }

      logger.debug(
        `Snowflake connection cache miss for ${cacheKey}, creating new connection`,
      );

      // Not in cache - create connection
      const conn = this.createSnowflakeConnection(connection);
      await conn.connectAsync();

      logger.debug(`Snowflake connection created and cached for ${cacheKey}`);

      // Cache it
      this.snowflakeConnectionCache.set(cacheKey, conn);

      return conn;
    });
  }

  /**
   * Obtains a session token from Snowflake using the authenticator and credentials
   * from the connection config. Supports "snowflake_jwt", "oauth", and "externalbrowser"
   * authenticators (case-insensitive).
   *
   * The session token is extracted directly from the SDK's internal connection state.
   * Do NOT call conn.destroy() — it invalidates the token.
   *
   * Connections are cached by account + user + authenticator + role plus a
   * digest of the credential material (oauth token / jwt key file) to avoid
   * repeated connection establishment for the same configuration. See
   * getCacheKeyForConnection for the exact key.
   */
  async getSnowflakeToken(
    connection: SnowflakeConnectionConfig,
  ): Promise<string> {
    const conn = await this.getOrCreateSnowflakeConnection(connection);
    const authenticator = connection.authenticator.toLowerCase();

    let parsed: unknown;
    try {
      parsed = JSON.parse(conn.serialize());
    } catch (err) {
      throw new Error(
        `unable to read ${authenticator} connection state: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err },
      );
    }

    const sessionToken = this.extractSerializedToken(parsed);

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new Error(
        `missing session token in ${authenticator} connection state`,
      );
    }

    return sessionToken;
  }

  /**
   * Extracts the session token from the private state returned by
   * connection.serialize(). This is an undocumented SDK internal; the SDK is
   * pinned to avoid breakage from internal restructuring.
   */
  private extractSerializedToken(parsed: unknown): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (parsed as any)?.services?.sf?.tokenInfo?.sessionToken;
  }

  async buildSnowflakeOptions(
    credential: Pick<
      Credential,
      "url" | "snowflakeConnection" | "apiKey" | "token" | "privateKey"
    >,
    extra?: Pick<ConnectAPIOptions, "rejectUnauthorized" | "timeout">,
  ): Promise<ConnectAPIOptions> {
    const connections = listConnections();
    const connectionName = credential.snowflakeConnection;
    const connectionConfig = connections[connectionName];
    if (!connectionConfig) {
      throw new Error(
        `Snowflake connection "${connectionName}" not found in connections.toml`,
      );
    }

    const snowflakeToken = await this.getSnowflakeToken(connectionConfig);

    if (credential.token && credential.privateKey) {
      return {
        url: credential.url,
        snowflakeToken,
        token: credential.token,
        privateKey: credential.privateKey,
        ...extra,
      };
    }
    if (credential.apiKey) {
      return {
        url: credential.url,
        snowflakeToken,
        apiKey: credential.apiKey,
        ...extra,
      };
    }
    // Legacy credential with no Connect auth — will fail at request time
    // but we still need to allow loading/displaying it.
    return {
      url: credential.url,
      snowflakeToken,
      ...extra,
    };
  }
}
