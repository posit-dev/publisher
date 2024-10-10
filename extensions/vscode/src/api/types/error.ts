// Copyright (C) 2023 by Posit Software, PBC.

type AgentErrorBase = {
  code: string;
  msg: string;
  operation: string;
};

export type AgentError = AgentErrorTypeUnknown | AgentErrorInvalidTOML;

export type AgentErrorTypeUnknown = AgentErrorBase & {
  data: {
    [key: string]: unknown;
  };
};

// This represents the Agent Errors we haven't been able to
// narrow down to a specific type.
export const isAgentErrorTypeUnknown = (
  e: AgentError,
): e is AgentErrorTypeUnknown => {
  return !isAgentErrorInvalidTOML(e);
};

export type AgentErrorInvalidTOML = AgentErrorBase & {
  data: {
    problem: string;
    file: string;
    line: number;
    column: number;
  };
};

export const isAgentErrorInvalidTOML = (
  e: AgentError,
): e is AgentErrorInvalidTOML => {
  return e.code === "invalidTOML" || e.code === "unknownTOMLKey";
};
