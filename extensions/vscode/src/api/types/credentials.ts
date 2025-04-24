// Copyright (C) 2024 by Posit Software, PBC.

import { AgentError } from "./error";

export enum AuthType {
  NONE = "none",
  API_KEY = "api-key",
  SNOWFLAKE = "snowflake",
}

export type Credential = {
  guid: string;
  name: string;
  url: string;
  apiKey: string;
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
  authType: AuthType | null;
  error: AgentError | null;
};
