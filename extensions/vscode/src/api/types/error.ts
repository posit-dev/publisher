// Copyright (C) 2023 by Posit Software, PBC.

import { ErrorCode } from "../../utils/errorTypes";

type AgentErrorBase = {
  code: ErrorCode;
  msg: string;
  operation: string;
};

export type AgentError =
  | AgentErrorTypeUnknown
  | AgentErrorInvalidTOML
  | AgentErrorContentNotRunning;

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
  return (
    !isAgentErrorInvalidTOML(e) && !isAgentErrorDeployedContentNotRunning(e)
  );
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

export type AgentErrorContentNotRunning = AgentErrorBase;

export const isAgentErrorDeployedContentNotRunning = (
  e: AgentError,
): e is AgentErrorContentNotRunning => {
  return e.code === "deployedContentNotRunning";
};
