// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";

import { Credential } from "src/api/types/credentials";
import { logger } from "./logging";

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
 * Idempotent full sync of credentials to SecretStorage.
 * Stores each credential in a versioned envelope and removes stale entries.
 */
export async function syncAllCredentials(
  secrets: SecretStorage,
  credentials: Credential[],
): Promise<void> {
  try {
    const currentGuids = new Set(credentials.map((c) => c.guid));

    // Store each credential
    for (const cred of credentials) {
      const key = `${KEY_PREFIX}${cred.guid}`;
      const envelope: CredentialEnvelope = {
        version: CURRENT_VERSION,
        credential: cred,
      };
      await secrets.store(key, JSON.stringify(envelope));
    }

    // Remove stale entries
    const allKeys = await secrets.keys();
    for (const key of allKeys) {
      if (key.startsWith(KEY_PREFIX)) {
        const guid = key.slice(KEY_PREFIX.length);
        if (!currentGuids.has(guid)) {
          await secrets.delete(key);
        }
      }
    }

    logger.info(`Synced ${credentials.length} credentials to SecretStorage`);
  } catch (err) {
    logger.warn(`Failed to sync credentials to SecretStorage: ${err}`);
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
