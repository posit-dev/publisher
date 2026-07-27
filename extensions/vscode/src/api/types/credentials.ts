// Copyright (C) 2024 by Posit Software, PBC.

import { GUID } from "@posit-dev/connect-api";

import { AgentError } from "./error";
import { ServerType } from "./contentRecords";

// NOTE: If you add or remove fields here, also update the field lists in
// credentials/storage.ts (REQUIRED_CREDENTIAL_FIELDS and, for fields added after
// v1 shipped, OPTIONAL_CREDENTIAL_FIELDS so older stored records still parse).
export type Credential = {
  guid: GUID;
  name: string;
  url: string;
  apiKey: string;
  snowflakeConnection: string;
  accountId: string;
  accountName: string;
  refreshToken: string;
  accessToken: string;
  cloudEnvironment: string;
  token: string;
  privateKey: string;
  /** OAuth 2.0 dynamic-client-registration client id (Connect OAuth). "" when unused. */
  oauthClientId: string;
  /** ISO-8601 access-token expiry for Connect OAuth. "" when unused/unknown. */
  tokenExpiresAt: string;
  serverType: ServerType;
};

export type CredentialUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type TestResult = {
  user: CredentialUser | null;
  url: string | null;
  serverType: ServerType | null;
  error: AgentError | null;
};
