// Copyright (C) 2023 by Posit Software, PBC.

export type AgentError = {
  code: string;
  msg: string;
  operation: string;
  data: {
    [key: string]: unknown;
  };
};
