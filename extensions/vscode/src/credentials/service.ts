// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";
import { randomUUID } from "crypto";

import { Credential } from "src/api/types/credentials";
import { ServerType } from "src/api/types/contentRecords";
import {
  getAllCredentials,
  getCredential,
  storeCredential,
  deleteCredential,
  deleteAllCredentials,
} from "./storage";
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
import { useApi } from "src/api";

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

export class CredentialsService {
  constructor(private readonly secrets: SecretStorage) {}

  list(): Promise<Credential[]> {
    return getAllCredentials(this.secrets);
  }

  async get(guid: string): Promise<Credential> {
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
          connectPresent ||
          connectCloudPresent ||
          tokenAuthPresent
        ) {
          throw new IncompleteCredentialError(
            "Snowflake credential requires a Snowflake connection string and no other auth fields",
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
      guid: randomUUID(),
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

    try {
      const api = await useApi();
      await api.credentials.create(cred);
    } catch (err) {
      logger.warn(
        `Credential "${cred.name}" (${cred.guid}) saved locally but could not be written to the system keyring. Deployments may not find this credential: ${err}`,
      );
    }

    return cred;
  }

  async delete(guid: string): Promise<void> {
    const cred = await getCredential(this.secrets, guid);
    if (!cred) {
      throw new CredentialNotFoundError(guid);
    }
    await deleteCredential(this.secrets, guid);

    try {
      const api = await useApi();
      await api.credentials.delete(guid);
    } catch (err) {
      logger.warn(
        `Credential (${guid}) removed locally but could not be removed from the system keyring: ${err}`,
      );
    }
  }

  async reset(): Promise<void> {
    logger.warn("Resetting all credentials");
    await deleteAllCredentials(this.secrets);

    try {
      const api = await useApi();
      await api.credentials.reset();
    } catch (err) {
      logger.warn(
        `Credentials cleared locally but could not be cleared from the system keyring: ${err}`,
      );
    }
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
}
