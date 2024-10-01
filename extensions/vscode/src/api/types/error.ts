// Copyright (C) 2023 by Posit Software, PBC.

export type AgentError = {
  code: string;
  msg: string;
  operation: string;
  data: {
    [key: string]: unknown;
  };
};

export type InvalidTOMLFileCodeError = {
  code: string;
  msg: string;
  operation: string;
  data: {
    problem: string;
    file: string;
    line: string;
    column: string;
  };
};

export const isInvalidTOMLFileCode = (
  agentError: AgentError | undefined,
): agentError is InvalidTOMLFileCodeError => {
  if (!agentError) {
    return false;
  }
  return (
    agentError.code === "invalidTOML" || agentError.code === "unknownTOMLKey"
  );
};
