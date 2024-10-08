// Copyright (C) 2023 by Posit Software, PBC.

type AgentErrorBase = {
  code: string;
  msg: string;
  operation: string;
};

export type AgentError =
  | AgentErrorTypeUnknown
  | AgentErrorInvalidTOML
  | AgentErrorPermissionError
  | AgentErrorPythonNotAvailable;

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
    !isAgentErrorInvalidTOML(e) &&
    !isAgentErrorPermissionError(e) &&
    !isAgentErrorPythonNotAvailable(e)
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

export type AgentErrorPermissionError = AgentErrorBase & {
  data: {
    code: string;
    error: string;
  };
};

export const isAgentErrorPermissionError = (
  e: AgentError,
): e is AgentErrorPermissionError => {
  return e.code === "permissionErr";
};

export type AgentErrorPythonNotAvailable = AgentErrorBase;

export const isAgentErrorPythonNotAvailable = (
  e: AgentError,
): e is AgentErrorPermissionError => {
  return e.code === "pythonNotAvailable";
};

export const getAgentErrorMsg = (e: AgentError) => {
  if (isAgentErrorInvalidTOML(e)) {
    return `Error: The selected Configuration has a schema error on line ${e.data.line}`;
  }
  if (isAgentErrorPermissionError(e)) {
    return `Error: ${e.data.error}`;
  }
  if (isAgentErrorPythonNotAvailable(e)) {
    return `Error: ${e.msg}`;
  }
  if (isAgentErrorTypeUnknown(e)) {
    return `Error: ${e.msg} ${e.data.error}`;
  }
  return `Error: ${e.msg}`;
};
