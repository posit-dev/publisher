// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";
import { randomUUID } from "crypto";
import { GUID, ConnectAPIOptions } from "@posit-dev/connect-api";
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
import { SnowflakeSecretStorageCredentialManager } from "src/snowflake/secretStorageCredentialManager";

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
    | "url"
    | "apiKey"
    | "token"
    | "privateKey"
    | "serverType"
    | "snowflakeConnection"
  >,
  extra?: Pick<ConnectAPIOptions, "rejectUnauthorized" | "timeout">,
): Promise<ConnectAPIOptions> {
  if (
    credential.serverType === ServerType.SNOWFLAKE &&
    credential.snowflakeConnection
  ) {
    return await service.buildSnowflakeOptions(credential, extra);
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
  constructor(private readonly secrets: SecretStorage) {
    snowflake.configure({
      customCredentialManager: new SnowflakeSecretStorageCredentialManager(
        secrets,
      ),
    });
  }

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

    switch (input.serverType) {
      case ServerType.CONNECT:
        if (
          (connectPresent && tokenAuthPresent) ||
          (!connectPresent && !tokenAuthPresent) ||
          snowflakePresent ||
          connectCloudPresent
        ) {
          throw new IncompleteCredentialError(
            "Connect credential requires either an API Key or Token+PrivateKey (but not both)",
          );
        }
        break;
      case ServerType.SNOWFLAKE:
        if (
          !snowflakePresent ||
          (connectPresent && tokenAuthPresent) ||
          (!connectPresent && !tokenAuthPresent) ||
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
          tokenAuthPresent
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

  /**
   * Obtains a session token from Snowflake using the authenticator and credentials
   * from the connection config. Supports "snowflake_jwt", "oauth", and "externalbrowser"
   * authenticators (case-insensitive).
   *
   * The session token is extracted directly from the SDK's internal connection state.
   * Do NOT call conn.destroy() — it invalidates the token.
   */
  async getSnowflakeToken(
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

    const sessionToken = this.extractSerializedToken(
      JSON.parse(conn.serialize()),
    );

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
