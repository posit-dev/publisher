// Copyright (C) 2024 by Posit Software, PBC.

import { AgentError } from "./error";
import { ServerType } from "./contentRecords";

export type Credential = {
  guid: string;
  name: string;
  url: string;
  apiKey: string;
  accountId: string;
  accountName: string;
  refreshToken: string;
  accessToken: string;
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
  // When true, Snowflake connections are configured on the system and Token
  // Authentication should be hidden (it won't work from within Snowflake).
  hasSnowflakeConnections: boolean;
  error: AgentError | null;
};
