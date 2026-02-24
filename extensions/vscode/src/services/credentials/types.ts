// Copyright (C) 2025 by Posit Software, PBC.

import { ServerType } from "../../api/types/contentRecords";

// CloudAuthToken represents an OAuth access token for Connect Cloud
export type CloudAuthToken = string;

// CloudEnvironment represents the Connect Cloud environment
export type CloudEnvironment = string;

// Current version of the credential schema
export const CURRENT_VERSION = 3;

// Service name for keyring storage
export const SERVICE_NAME = "Posit Publisher Safe Storage";

// Prefix for credential keys in keyring
export const CREDENTIAL_KEY_PREFIX = "credential_";

// Key for storing list of credential GUIDs
export const CREDENTIAL_GUIDS_KEY = "credential_guids";

/**
 * Credential represents a fully hydrated credential for accessing a server.
 * This matches the Go Credential struct.
 */
export interface Credential {
  guid: string;
  name: string;
  serverType: ServerType;
  url: string;

  // Connect fields
  apiKey: string;

  // Snowflake fields
  snowflakeConnection: string;

  // Connect Cloud fields
  accountId: string;
  accountName: string;
  refreshToken: string;
  accessToken: CloudAuthToken;
  cloudEnvironment: CloudEnvironment;

  // Token authentication fields
  token: string;
  privateKey: string;
}

/**
 * FileCredential represents a credential as stored in the TOML file.
 * Uses snake_case keys to match TOML file format.
 */
export interface FileCredential {
  guid: string;
  version: number;
  server_type: ServerType;
  url: string;

  // Connect fields
  api_key?: string;

  // Snowflake fields
  snowflake_connection?: string;

  // Connect Cloud fields
  account_id?: string;
  account_name?: string;
  refresh_token?: string;
  access_token?: CloudAuthToken;
  cloud_environment?: CloudEnvironment;

  // Token authentication fields
  token?: string;
  private_key?: string;
}

/**
 * FileCredentials represents the entire TOML file structure.
 * Credentials are keyed by name.
 */
export interface FileCredentials {
  credentials: Record<string, FileCredential>;
}

/**
 * CredentialRecord represents a versioned credential stored in the keyring.
 * The data field contains the JSON-encoded credential.
 */
export interface CredentialRecord {
  guid: string;
  version: number;
  data: Credential;
}

/**
 * CredentialTable is a map of credential GUIDs to CredentialRecords.
 */
export type CredentialTable = Record<string, CredentialRecord>;

/**
 * CreateCredentialDetails contains the information needed to create a new credential.
 */
export interface CreateCredentialDetails {
  guid?: string; // Optional, used for migration to preserve original GUID
  name: string;
  url: string;
  serverType: ServerType;

  // Connect fields
  apiKey?: string;

  // Snowflake fields
  snowflakeConnection?: string;

  // Connect Cloud fields
  accountId?: string;
  accountName?: string;
  refreshToken?: string;
  accessToken?: CloudAuthToken;
  cloudEnvironment?: CloudEnvironment;

  // Token authentication fields
  token?: string;
  privateKey?: string;
}

/**
 * Checks if a FileCredential has valid authentication fields.
 */
export function isFileCredentialValid(cred: FileCredential): boolean {
  return (
    cred.url !== "" &&
    ((cred.api_key !== undefined && cred.api_key !== "") ||
      (cred.snowflake_connection !== undefined &&
        cred.snowflake_connection !== "") ||
      (cred.account_id !== undefined &&
        cred.account_id !== "" &&
        cred.account_name !== undefined &&
        cred.account_name !== "" &&
        cred.refresh_token !== undefined &&
        cred.refresh_token !== "" &&
        cred.access_token !== undefined &&
        cred.access_token !== "") ||
      (cred.token !== undefined &&
        cred.token !== "" &&
        cred.private_key !== undefined &&
        cred.private_key !== ""))
  );
}

/**
 * Converts a FileCredential to a Credential.
 */
export function fileCredentialToCredential(
  name: string,
  fileCred: FileCredential,
): Credential {
  return {
    guid: fileCred.guid,
    name: name,
    serverType: fileCred.server_type,
    url: fileCred.url,
    apiKey: fileCred.api_key ?? "",
    snowflakeConnection: fileCred.snowflake_connection ?? "",
    accountId: fileCred.account_id ?? "",
    accountName: fileCred.account_name ?? "",
    refreshToken: fileCred.refresh_token ?? "",
    accessToken: fileCred.access_token ?? "",
    cloudEnvironment: fileCred.cloud_environment ?? "",
    token: fileCred.token ?? "",
    privateKey: fileCred.private_key ?? "",
  };
}

/**
 * Converts a Credential to a FileCredential.
 */
export function credentialToFileCredential(cred: Credential): FileCredential {
  const fileCred: FileCredential = {
    guid: cred.guid,
    version: CURRENT_VERSION,
    server_type: cred.serverType,
    url: cred.url,
  };

  // Only include non-empty optional fields
  if (cred.apiKey) fileCred.api_key = cred.apiKey;
  if (cred.snowflakeConnection)
    fileCred.snowflake_connection = cred.snowflakeConnection;
  if (cred.accountId) fileCred.account_id = cred.accountId;
  if (cred.accountName) fileCred.account_name = cred.accountName;
  if (cred.refreshToken) fileCred.refresh_token = cred.refreshToken;
  if (cred.accessToken) fileCred.access_token = cred.accessToken;
  if (cred.cloudEnvironment) fileCred.cloud_environment = cred.cloudEnvironment;
  if (cred.token) fileCred.token = cred.token;
  if (cred.privateKey) fileCred.private_key = cred.privateKey;

  return fileCred;
}
