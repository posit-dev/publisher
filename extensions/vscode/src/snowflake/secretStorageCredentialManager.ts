// Copyright (C) 2026 by Posit Software, PBC.

import { SecretStorage } from "vscode";

const KEY_PREFIX = "snowflake-token:";

// Snowflake SDK's credential manager validation requires methods to be own properties
// of the object (checked via Object.hasOwnProperty), not inherited from the prototype.
// We use property assignments in the constructor to ensure they pass validation.
export class SnowflakeSecretStorageCredentialManager {
  readonly write: (key: string, token: string) => Promise<null>;
  readonly read: (key: string) => Promise<string | null>;
  readonly remove: (key: string) => Promise<null>;

  constructor(private readonly secrets: SecretStorage) {
    this.write = async (key: string, token: string): Promise<null> => {
      await this.secrets.store(KEY_PREFIX + key, token);
      return null;
    };

    this.read = async (key: string): Promise<string | null> => {
      return (await this.secrets.get(KEY_PREFIX + key)) ?? null;
    };

    this.remove = async (key: string): Promise<null> => {
      await this.secrets.delete(KEY_PREFIX + key);
      return null;
    };
  }
}
