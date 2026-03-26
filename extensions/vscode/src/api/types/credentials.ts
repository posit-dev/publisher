// Copyright (C) 2024 by Posit Software, PBC.

import { AgentError } from "./error";
import { ServerType } from "./contentRecords";

// NOTE: If you add or remove fields here, also update
// REQUIRED_CREDENTIAL_FIELDS in credentials/storage.ts.
export type Credential = {
  guid: string;
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
