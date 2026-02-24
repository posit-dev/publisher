// Copyright (C) 2024 by Posit Software, PBC.

import { AgentError } from "./error";
import { ServerType } from "./contentRecords";

// CloudAuthToken represents an OAuth access token for Connect Cloud
export type CloudAuthToken = string;

// CloudEnvironment represents the Connect Cloud environment
export type CloudEnvironment = string;

export type Credential = {
  guid: string;
  name: string;
  url: string;
  serverType: ServerType;

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
