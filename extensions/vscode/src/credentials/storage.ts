// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";

import { Credential } from "src/api/types/credentials";
import { logger } from "src/logging";

const KEY_PREFIX = "credential:";
const CURRENT_VERSION = 1;

interface CredentialEnvelope {
  version: number;
  credential: Credential;
}

const REQUIRED_CREDENTIAL_FIELDS: (keyof Credential)[] = [
  "guid",
  "name",
  "url",
  "apiKey",
  "snowflakeConnection",
  "accountId",
  "accountName",
  "refreshToken",
  "accessToken",
  "cloudEnvironment",
  "token",
  "privateKey",
  "serverType",
];

/**
 * Parse and validate a JSON credential record from SecretStorage.
 * Returns the credential if valid, or undefined if malformed.
 */
export function parseCredentialRecord(json: string): Credential | undefined {
  try {
    const envelope = JSON.parse(json) as CredentialEnvelope;

    if (envelope.version !== CURRENT_VERSION) {
      logger.warn(
        `Credential record has unsupported version: ${envelope.version}`,
      );
      return undefined;
    }

    const cred = envelope.credential;
    if (!cred || typeof cred !== "object") {
      logger.warn("Credential record is missing credential object");
      return undefined;
    }

    for (const field of REQUIRED_CREDENTIAL_FIELDS) {
      if (typeof cred[field] !== "string") {
        logger.warn(
          `Credential record is missing or has invalid field: ${field}`,
        );
        return undefined;
      }
    }

    return cred;
  } catch (err) {
    logger.warn(`Failed to parse credential record: ${err}`);
    return undefined;
  }
}

/**
 * Store a single credential in SecretStorage.
 */
export async function storeCredential(
  secrets: SecretStorage,
  credential: Credential,
): Promise<void> {
  const key = `${KEY_PREFIX}${credential.guid}`;
  const envelope: CredentialEnvelope = {
    version: CURRENT_VERSION,
    credential,
  };
  await secrets.store(key, JSON.stringify(envelope));
}

/**
 * Read a single credential from SecretStorage by GUID.
 * Returns undefined if the key doesn't exist or the record is malformed.
 */
export async function getCredential(
  secrets: SecretStorage,
  guid: string,
): Promise<Credential | undefined> {
  const json = await secrets.get(`${KEY_PREFIX}${guid}`);
  if (json === undefined) {
    return undefined;
  }
  return parseCredentialRecord(json);
}

/**
 * Delete a single credential from SecretStorage by GUID.
 */
export async function deleteCredential(
  secrets: SecretStorage,
  guid: string,
): Promise<void> {
  await secrets.delete(`${KEY_PREFIX}${guid}`);
}

/**
 * Delete all credential entries from SecretStorage.
 */
export async function deleteAllCredentials(
  secrets: SecretStorage,
): Promise<void> {
  const allKeys = await secrets.keys();
  for (const key of allKeys) {
    if (key.startsWith(KEY_PREFIX)) {
      await secrets.delete(key);
    }
  }
}

/**
 * Read all valid credentials from SecretStorage.
 * Skips malformed entries with a warning instead of failing entirely.
 */
export async function getAllCredentials(
  secrets: SecretStorage,
): Promise<Credential[]> {
  try {
    const allKeys = await secrets.keys();
    const credentialKeys = allKeys.filter((k) => k.startsWith(KEY_PREFIX));
    const credentials: Credential[] = [];

    for (const key of credentialKeys) {
      const json = await secrets.get(key);
      if (json === undefined) {
        continue;
      }
      const cred = parseCredentialRecord(json);
      if (cred) {
        credentials.push(cred);
      }
    }

    return credentials;
  } catch (err) {
    logger.warn(`Failed to read credentials from SecretStorage: ${err}`);
    return [];
  }
}
