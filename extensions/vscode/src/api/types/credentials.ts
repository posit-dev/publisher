// Copyright (C) 2024 by Posit Software, PBC.

import { AgentError } from "./error";
import { ServerType } from "./contentRecords";

export type Credential = {
  guid: string;
  name: string;
  url: string;
  apiKey: string;
  snowflakeConnection: string;
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
