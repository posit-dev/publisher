// Copyright (C) 2025 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Mutex } from "async-mutex";
import * as TOML from "smol-toml";

import { CredentialsService } from "./credentialsService";
import {
  Credential,
  CreateCredentialDetails,
  FileCredential,
  FileCredentials,
  fileCredentialToCredential,
  credentialToFileCredential,
} from "./types";
import {
  NotFoundError,
  LoadError,
  IdentityCollisionError,
  NameCollisionError,
  IncompleteCredentialError,
  BackupError,
} from "./errors";
import { ServerType } from "../../api/types/contentRecords";
import { normalizeURL, formatURL } from "../../utils/url";

const ONDISK_FILENAME = ".connect-credentials";

/**
 * Generates a UUIDv4.
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalizes a server URL by ensuring it has a scheme and trailing slash.
 */
function normalizeServerURL(url: string): string {
  return normalizeURL(formatURL(url));
}

/**
 * Infers server type from URL.
 */
function serverTypeFromURL(urlStr: string): ServerType {
  try {
    const url = new URL(formatURL(urlStr));
    const host = url.hostname;

    if (host.endsWith("connect.posit.cloud")) {
      return ServerType.CONNECT_CLOUD;
    } else if (
      host.endsWith(".snowflakecomputing.app") ||
      host.endsWith(".privatelink.snowflake.app")
    ) {
      return ServerType.SNOWFLAKE;
    }
    return ServerType.CONNECT;
  } catch {
    return ServerType.CONNECT;
  }
}

/**
 * Checks if a server type is Connect Cloud.
 */
function isCloud(serverType: ServerType): boolean {
  return serverType === ServerType.CONNECT_CLOUD;
}

/**
 * Checks if a server type is Connect-like (Connect or Snowflake).
 */
function isConnectLike(serverType: ServerType): boolean {
  return (
    serverType === ServerType.CONNECT || serverType === ServerType.SNOWFLAKE
  );
}

/**
 * File-based credentials service.
 * Stores credentials in ~/.connect-credentials as TOML.
 */
export class FileCredentialsService implements CredentialsService {
  private mutex = new Mutex();
  private credsFilepath: string;

  constructor(credentialsPath?: string) {
    this.credsFilepath =
      credentialsPath ?? path.join(os.homedir(), ONDISK_FILENAME);
  }

  /**
   * Gets the credentials file path. Useful for testing.
   */
  getFilePath(): string {
    return this.credsFilepath;
  }

  /**
   * Ensures the credentials file exists.
   */
  async setup(): Promise<void> {
    try {
      await fs.access(this.credsFilepath);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(this.credsFilepath, "", { mode: 0o644 });
    }
  }

  async delete(guid: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const creds = await this.load();
      const credential = this.findCredentialByGuid(creds, guid);
      if (!credential) {
        throw new NotFoundError(guid);
      }

      delete creds.credentials[credential.name];
      await this.saveFile(creds);
    } finally {
      release();
    }
  }

  async get(guid: string): Promise<Credential> {
    const release = await this.mutex.acquire();
    try {
      const creds = await this.load();
      const credential = this.findCredentialByGuid(creds, guid);
      if (!credential) {
        throw new NotFoundError(guid);
      }
      return credential;
    } finally {
      release();
    }
  }

  async list(): Promise<Credential[]> {
    const release = await this.mutex.acquire();
    try {
      const creds = await this.load();
      return this.credentialsList(creds);
    } finally {
      release();
    }
  }

  set(details: CreateCredentialDetails): Promise<Credential> {
    return this.setInternal(details, true);
  }

  forceSet(details: CreateCredentialDetails): Promise<Credential> {
    return this.setInternal(details, false);
  }

  async reset(): Promise<string> {
    const release = await this.mutex.acquire();
    try {
      const backupPath = await this.backupFile();
      const newData: FileCredentials = { credentials: {} };
      await this.saveFile(newData);
      return backupPath;
    } finally {
      release();
    }
  }

  private async setInternal(
    details: CreateCredentialDetails,
    checkConflict: boolean,
  ): Promise<Credential> {
    const release = await this.mutex.acquire();
    try {
      const creds = await this.load();
      const credential = this.detailsToCredential(details);

      if (checkConflict) {
        this.checkForConflicts(creds, credential);
      }

      creds.credentials[details.name] = credentialToFileCredential(credential);
      await this.saveFile(creds);
      return credential;
    } finally {
      release();
    }
  }

  private detailsToCredential(details: CreateCredentialDetails): Credential {
    // Validate required fields
    const connectPresent = !!details.apiKey;
    const snowflakePresent = !!details.snowflakeConnection;
    const connectCloudPresent =
      !!details.accountId &&
      !!details.accountName &&
      !!details.refreshToken &&
      !!details.accessToken;
    const tokenAuthPresent = !!details.token && !!details.privateKey;

    switch (details.serverType) {
      case ServerType.CONNECT:
        // Connect can use either API key or token auth, but not both
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

    if (!details.name || !details.url) {
      throw new IncompleteCredentialError();
    }

    const normalizedUrl = normalizeServerURL(details.url);
    const guid = details.guid || generateUUID();

    return {
      guid,
      name: details.name,
      serverType: details.serverType,
      url: normalizedUrl,
      apiKey: details.apiKey ?? "",
      snowflakeConnection: details.snowflakeConnection ?? "",
      accountId: details.accountId ?? "",
      accountName: details.accountName ?? "",
      refreshToken: details.refreshToken ?? "",
      accessToken: details.accessToken ?? "",
      cloudEnvironment: details.cloudEnvironment ?? "",
      token: details.token ?? "",
      privateKey: details.privateKey ?? "",
    };
  }

  private checkForConflicts(creds: FileCredentials, newCred: Credential): void {
    const credsList = this.credentialsList(creds);

    for (const cred of credsList) {
      // Check for identity collision
      if (isCloud(newCred.serverType)) {
        // Connect Cloud credentials must have unique AccountID and CloudEnvironment combinations
        if (
          isCloud(cred.serverType) &&
          cred.accountId === newCred.accountId &&
          cred.cloudEnvironment === newCred.cloudEnvironment
        ) {
          throw new IdentityCollisionError(
            cred.name,
            cred.url,
            cred.accountName,
          );
        }
      } else {
        // Connect/Snowflake credentials have unique URLs
        if (isConnectLike(cred.serverType) && cred.url === newCred.url) {
          throw new IdentityCollisionError(
            cred.name,
            cred.url,
            cred.accountName,
          );
        }
      }

      // Check for name collision
      if (newCred.name === cred.name) {
        throw new NameCollisionError(cred.name, cred.url);
      }
    }
  }

  private async load(): Promise<FileCredentials> {
    try {
      await this.setup();
      const content = await fs.readFile(this.credsFilepath, "utf-8");

      if (!content.trim()) {
        return { credentials: {} };
      }

      const parsed = TOML.parse(content) as unknown as FileCredentials;

      // Ensure credentials object exists
      if (!parsed.credentials) {
        return { credentials: {} };
      }

      // Normalize URLs for all credentials
      this.normalizeAll(parsed);

      return parsed;
    } catch (err) {
      if (err instanceof Error && err.message.includes("ENOENT")) {
        return { credentials: {} };
      }
      throw new LoadError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async saveFile(credsData: FileCredentials): Promise<void> {
    const content = TOML.stringify(credsData);
    await fs.writeFile(this.credsFilepath, content, { mode: 0o644 });
  }

  private async backupFile(): Promise<string> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const backupPath = path.join(
      path.dirname(this.credsFilepath),
      `${ONDISK_FILENAME}-${today}`,
    );

    try {
      const content = await fs.readFile(this.credsFilepath, "utf-8");
      await fs.writeFile(backupPath, content, { mode: 0o644 });
      return backupPath;
    } catch (err) {
      throw new BackupError(
        backupPath,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  private normalizeAll(creds: FileCredentials): void {
    for (const [name, fileCred] of Object.entries(creds.credentials)) {
      if (fileCred.url) {
        try {
          fileCred.url = normalizeServerURL(fileCred.url);
          creds.credentials[name] = fileCred;
        } catch {
          // Ignore normalization errors
        }
      }
    }
  }

  private credentialsList(creds: FileCredentials): Credential[] {
    const list: Credential[] = [];
    for (const [name, fileCred] of Object.entries(creds.credentials)) {
      // Infer server type from URL if not present
      const serverType =
        fileCred.server_type || serverTypeFromURL(fileCred.url);
      const credWithServerType: FileCredential = {
        ...fileCred,
        server_type: serverType,
      };
      list.push(fileCredentialToCredential(name, credWithServerType));
    }
    return list;
  }

  private findCredentialByGuid(
    creds: FileCredentials,
    guid: string,
  ): Credential | null {
    for (const [name, fileCred] of Object.entries(creds.credentials)) {
      if (fileCred.guid === guid) {
        const serverType =
          fileCred.server_type || serverTypeFromURL(fileCred.url);
        const credWithServerType: FileCredential = {
          ...fileCred,
          server_type: serverType,
        };
        return fileCredentialToCredential(name, credWithServerType);
      }
    }
    return null;
  }
}
