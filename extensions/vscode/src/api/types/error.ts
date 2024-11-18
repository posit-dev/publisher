/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (C) 2023 by Posit Software, PBC.

import { ErrorCode } from "../../utils/errorTypes";

type AgentErrorBase = {
  code: ErrorCode;
  msg: string;
  operation: string;
};

export const isAgentError = (e: any): e is AgentError => {
  const keys = Object.keys(e);
  if (keys.length) {
    if (
      keys.includes("code") &&
      keys.includes("msg") &&
      keys.includes("operation")
    ) {
      return true;
    }
  }
  return false;
};

export type AgentError =
  | AgentErrorBase
  | AgentErrorTypeUnknown
  | AgentErrorInvalidTOML
  | AgentErrorContentNotRunning;

export type AgentErrorTypeUnknown = AgentErrorBase & {
  data: {
    [key: string]: unknown;
  };
};

export const isAgentErrorBase = (e: any): e is AgentErrorBase => {
  if (isAgentError(e)) {
    const keys = Object.keys(e);
    if (keys.length) {
      if (keys.includes("data")) {
        return true;
      }
    }
  }
  return false;
};

// This represents the Agent Errors we haven't been able to
// narrow down to a specific type.
export const isAgentErrorTypeUnknown = (e: any): e is AgentErrorTypeUnknown => {
  return (
    isAgentErrorBase(e) &&
    !isAgentErrorInvalidTOML(e) &&
    !isAgentErrorDeployedContentNotRunning(e)
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

export const isAgentErrorInvalidTOML = (e: any): e is AgentErrorInvalidTOML => {
  return (
    isAgentErrorBase(e) &&
    (e.code === "invalidTOML" || e.code === "unknownTOMLKey")
  );
};

export type AgentErrorContentNotRunning = AgentErrorBase;

export const isAgentErrorDeployedContentNotRunning = (
  e: any,
): e is AgentErrorContentNotRunning => {
  return isAgentErrorBase(e) && e.code === "deployedContentNotRunning";
};
