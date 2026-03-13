// Copyright (C) 2026 by Posit Software, PBC.

export class CredentialNotFoundError extends Error {
  constructor(guid: string) {
    super(`credential not found: ${guid}`);
    this.name = "CredentialNotFoundError";
  }
}

export class CredentialNameCollisionError extends Error {
  constructor(existingName: string, existingUrl: string) {
    super(
      `Name value conflicts with existing credential (${existingName}) URL: ${existingUrl}`,
    );
    this.name = "CredentialNameCollisionError";
  }
}

export class CredentialIdentityCollisionError extends Error {
  constructor(existingName: string, existingUrl: string, accountName: string) {
    let msg = `URL value conflicts with existing credential (${existingName}) URL: ${existingUrl}`;
    if (accountName) {
      msg += `, account name: ${accountName}`;
    }
    super(msg);
    this.name = "CredentialIdentityCollisionError";
  }
}

export class IncompleteCredentialError extends Error {
  constructor() {
    super(
      "New credentials require non-empty Name, URL, Server Type, and either API Key, Snowflake, or Connect Cloud connection fields",
    );
    this.name = "IncompleteCredentialError";
  }
}
