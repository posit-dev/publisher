// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";
import { randomUUID } from "crypto";

import { Credential } from "src/api/types/credentials";
import { ServerType } from "src/api/types/contentRecords";
import { getAllCredentials, syncAllCredentials } from "./storage";
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
    const all = await this.list();
    const cred = all.find((c) => c.guid === guid);
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
          throw new IncompleteCredentialError();
        }
        break;
      case ServerType.SNOWFLAKE:
        if (
          !snowflakePresent ||
          connectPresent ||
          connectCloudPresent ||
          tokenAuthPresent
        ) {
          throw new IncompleteCredentialError();
        }
        break;
      case ServerType.CONNECT_CLOUD:
        if (
          !connectCloudPresent ||
          connectPresent ||
          snowflakePresent ||
          tokenAuthPresent
        ) {
          throw new IncompleteCredentialError();
        }
        break;
      default:
        throw new IncompleteCredentialError();
    }

    // For cloud credentials, derive the URL from the cloud environment
    let url: string;
    if (input.serverType === ServerType.CONNECT_CLOUD) {
      url = config.connectCloudURL;
    } else {
      if (!input.url) {
        throw new IncompleteCredentialError();
      }
      url = input.url;
    }

    if (!input.name) {
      throw new IncompleteCredentialError();
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

    existing.push(cred);
    await syncAllCredentials(this.secrets, existing);
    return cred;
  }

  async delete(guid: string): Promise<void> {
    const all = await this.list();
    const index = all.findIndex((c) => c.guid === guid);
    if (index === -1) {
      throw new CredentialNotFoundError(guid);
    }
    all.splice(index, 1);
    await syncAllCredentials(this.secrets, all);
  }

  async reset(): Promise<void> {
    logger.warn("Resetting all credentials");
    await syncAllCredentials(this.secrets, []);
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
