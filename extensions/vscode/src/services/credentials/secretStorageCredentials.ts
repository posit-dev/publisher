// Copyright (C) 2025 by Posit Software, PBC.

import { SecretStorage } from "vscode";

import { CredentialsService } from "./credentialsService";
import {
  Credential,
  CreateCredentialDetails,
  CredentialRecord,
  CredentialTable,
  CURRENT_VERSION,
  CREDENTIAL_KEY_PREFIX,
  CREDENTIAL_GUIDS_KEY,
} from "./types";
import {
  NotFoundError,
  IdentityCollisionError,
  NameCollisionError,
  IncompleteCredentialError,
  CorruptedError,
} from "./errors";
import { ServerType } from "../../api/types/contentRecords";
import { normalizeURL, formatURL } from "../../utils/url";

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
 * SecretStorage-based credentials service.
 * Uses VS Code's built-in SecretStorage API for secure credential storage.
 *
 * Storage format:
 * - credential_<guid>: JSON-encoded CredentialRecord for each credential
 * - credential_guids: JSON-encoded array of GUIDs to enumerate credentials
 */
export class SecretStorageCredentialsService implements CredentialsService {
  private secrets: SecretStorage;
  private supported: boolean | null = null;

  constructor(secrets: SecretStorage) {
    this.secrets = secrets;
  }

  /**
   * Checks if the secret storage is available and working.
   */
  async isSupported(): Promise<boolean> {
    if (this.supported !== null) {
      return this.supported;
    }

    try {
      // Try to access the storage
      await this.getKnownCredentialGuids();
      this.supported = true;
      return true;
    } catch {
      this.supported = false;
      return false;
    }
  }

  async delete(guid: string): Promise<void> {
    const table = await this.load();

    if (!table[guid]) {
      throw new NotFoundError(guid);
    }

    delete table[guid];

    // Delete the credential from storage
    const key = CREDENTIAL_KEY_PREFIX + guid;
    await this.secrets.delete(key);

    // Update the GUID list
    await this.removeGuidFromList(guid);
  }

  async get(guid: string): Promise<Credential> {
    const table = await this.load();

    const record = table[guid];
    if (!record) {
      throw new NotFoundError(guid);
    }

    return this.recordToCredential(record);
  }

  async list(): Promise<Credential[]> {
    const records = await this.load();
    const creds: Credential[] = [];

    for (const record of Object.values(records)) {
      const cred = this.recordToCredential(record);
      creds.push(cred);
    }

    return creds;
  }

  set(details: CreateCredentialDetails): Promise<Credential> {
    return this.setInternal(details, true);
  }

  forceSet(details: CreateCredentialDetails): Promise<Credential> {
    return this.setInternal(details, false);
  }

  async reset(): Promise<string> {
    // Get all known GUIDs and delete each credential
    const knownGuids = await this.getKnownCredentialGuids();

    for (const guid of knownGuids) {
      const key = CREDENTIAL_KEY_PREFIX + guid;
      await this.secrets.delete(key);
    }

    // Delete the GUIDs list
    await this.secrets.delete(CREDENTIAL_GUIDS_KEY);

    // No backup possible for encrypted storage
    return "";
  }

  private async setInternal(
    details: CreateCredentialDetails,
    checkConflict: boolean,
  ): Promise<Credential> {
    const table = await this.load();
    const credential = this.detailsToCredential(details);

    let guidToUpdate = credential.guid;

    if (checkConflict) {
      this.checkForConflicts(table, credential);
    } else {
      // Find existing credential with same name to update
      for (const [guid, record] of Object.entries(table)) {
        const tableCred = this.recordToCredential(record);
        if (tableCred.name === details.name) {
          guidToUpdate = guid;
          break;
        }
      }
    }

    credential.guid = guidToUpdate;

    const record: CredentialRecord = {
      guid: guidToUpdate,
      version: CURRENT_VERSION,
      data: credential,
    };

    table[guidToUpdate] = record;

    // Update the GUID list
    await this.updateGuidsListFor(guidToUpdate);

    // Save the credential
    await this.save(table);

    return credential;
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

  private checkForConflicts(table: CredentialTable, newCred: Credential): void {
    for (const [_guid, record] of Object.entries(table)) {
      const cred = this.recordToCredential(record);

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

  private recordToCredential(record: CredentialRecord): Credential {
    // The data is already a Credential object for version 3
    if (record.version === CURRENT_VERSION) {
      return record.data;
    }

    // Handle version migration if needed
    // For now, we only support current version
    throw new CorruptedError(record.guid);
  }

  private async load(): Promise<CredentialTable> {
    const table: CredentialTable = {};

    const knownGuids = await this.getKnownCredentialGuids();

    for (const guid of knownGuids) {
      const key = CREDENTIAL_KEY_PREFIX + guid;
      const data = await this.secrets.get(key);

      if (!data) {
        // Skip non-existent credentials
        continue;
      }

      try {
        const record = JSON.parse(data) as CredentialRecord;
        table[guid] = record;
      } catch {
        // Skip corrupted credentials
        continue;
      }
    }

    return table;
  }

  private async save(table: CredentialTable): Promise<void> {
    for (const [guid, record] of Object.entries(table)) {
      const key = CREDENTIAL_KEY_PREFIX + guid;
      const data = JSON.stringify(record);
      await this.secrets.store(key, data);
    }
  }

  private async getKnownCredentialGuids(): Promise<string[]> {
    const data = await this.secrets.get(CREDENTIAL_GUIDS_KEY);

    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data) as string[];
    } catch {
      return [];
    }
  }

  private async updateGuidsListFor(guid: string): Promise<void> {
    const guids = await this.getKnownCredentialGuids();

    // Check if already in list
    if (guids.includes(guid)) {
      return;
    }

    guids.push(guid);
    await this.saveGuidList(guids);
  }

  private async removeGuidFromList(guid: string): Promise<void> {
    const guids = await this.getKnownCredentialGuids();
    const updatedGuids = guids.filter((g) => g !== guid);
    await this.saveGuidList(updatedGuids);
  }

  private async saveGuidList(guids: string[]): Promise<void> {
    const data = JSON.stringify(guids);
    await this.secrets.store(CREDENTIAL_GUIDS_KEY, data);
  }
}
