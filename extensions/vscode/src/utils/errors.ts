// Copyright (C) 2023 by Posit Software, PBC.

import axios from "axios";
import { isAxiosErrorWithJson, resolveAgentJsonErrorMsg } from "./errorTypes";
import { isAgentError } from "../api/types/error";

export type ErrorMessage = string[];
export type ErrorMessages = ErrorMessage[];

export const getStatusFromError = (error: unknown): number | undefined => {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
};

export const getStatusStringFromErrorResponse = (
  error: unknown,
): string | undefined => {
  if (axios.isAxiosError(error)) {
    return error.response?.statusText;
  }
  return undefined;
};

export const getCodeStringFromError = (error: unknown): string | undefined => {
  if (axios.isAxiosError(error)) {
    return error.code;
  }
  if (isAgentError(error)) {
    return error.code;
  }
  return undefined;
};

export const isConnectionRefusedError = (error: unknown): boolean => {
  if (axios.isAxiosError(error) && error.code === "ECONNREFUSED") {
    return true;
  }
  return false;
};

export const getMessageFromError = (error: unknown): string => {
  try {
    if (isAxiosErrorWithJson(error)) {
      return resolveAgentJsonErrorMsg(error);
    }
    if (axios.isAxiosError(error)) {
      // Handle connection refused errors with a descriptive message
      if (error.code === "ECONNREFUSED") {
        return "Publisher backend unavailable";
      }
      return error.response?.data || error.message;
    }
    if (isAgentError(error)) {
      return error.msg;
    }
    if (error instanceof Error) {
      return error.message;
    }
  } catch {
    // errors suppressed
  }
  return "";
};

/**
 * Like `getMessageFromError`, but never returns an empty string.
 *
 * `getMessageFromError` yields "" for anything it doesn't recognize — a non-Error
 * throw, an Error with an empty message, a control-flow sentinel — which makes
 * interpolated diagnostics name no cause at all ("sign-in did not complete: .").
 * Use this wherever the message is the only thing a user or a log will see.
 */
export const describeError = (error: unknown): string => {
  const message = getMessageFromError(error);
  if (message) {
    return message;
  }
  if (error instanceof Error) {
    // `name` is only meaningful when a subclass sets it — `class Foo extends
    // Error {}` inherits the literal "Error" — so prefer the constructor name
    // once `name` turns out to be the generic default.
    if (error.name && error.name !== "Error") {
      return error.name;
    }
    const ctor = error.constructor?.name;
    if (ctor && ctor !== "Object") {
      return ctor;
    }
  }
  try {
    const text = typeof error === "string" ? error : JSON.stringify(error);
    if (text && text !== "{}" && text !== '""') {
      return text;
    }
  } catch {
    // Not serializable (circular, or a throwing toJSON); use the generic text.
  }
  return "no error details were reported";
};

export const getAPIURLFromError = (error: unknown) => {
  if (axios.isAxiosError(error) && error.config) {
    return {
      baseURL: error.config.baseURL,
      method: error.config.method,
      url: error.config.url,
    };
  }
  return undefined;
};

// This method builds a diagnostic message which is output to the
// VSCode console (output/window) to help diagnose, but then returns the
// base error string from the error.
export const getSummaryStringFromError = (location: string, error: unknown) => {
  let logMsg = `Posit Publisher: An error has occurred at ${location}`;
  let msg = getMessageFromError(error);
  if (msg === "") {
    msg = "Unknown Error";
    logMsg += `: ${msg}, ${JSON.stringify(error)}`;
  } else {
    logMsg += `: ${msg}`;
  }
  if (isAgentError(error)) {
    if (error.code) {
      logMsg += `, Code=${error.code}`;
    }
    if (error.operation) {
      logMsg += `, Operation=${error.operation}`;
    }
  } else if (!isAxiosErrorWithJson(error)) {
    const summary = getSummaryFromError(error);
    if (summary) {
      if (summary.status) {
        logMsg += `, Status=${summary.status}`;
      }
      if (summary.statusText) {
        logMsg += `, StatusText=${summary.statusText}`;
      }
      if (summary.code) {
        logMsg += `, Code=${summary.code}`;
      }
      if (summary.msg) {
        logMsg += `, Msg=${summary.msg}`;
      }
      if (summary.baseURL || summary.method || summary.url) {
        logMsg += `, URL=${summary.baseURL}/${summary.method}/${summary.url}`;
      }
    } else {
      logMsg += `, Error=${error}`;
    }
  }
  console.error(logMsg);
  return msg;
};

export const getSummaryFromError = (error: unknown) => {
  const status = getStatusFromError(error);
  const statusText = getStatusStringFromErrorResponse(error);
  const code = getCodeStringFromError(error);
  const msg = getMessageFromError(error);
  const url = getAPIURLFromError(error);

  if (status || statusText || code || msg || url) {
    return {
      status,
      statusText,
      code,
      msg,
      ...url,
    };
  }
  return undefined;
};

export const checkForResponseWithStatus = (
  error: unknown,
  statusValue: number,
) => {
  const errorStatus = getStatusFromError(error);
  return errorStatus === statusValue;
};

export const scrubErrorData = (data: Record<string, unknown> | undefined) => {
  if (!data) {
    return undefined;
  }
  // remove what we don't want to display
  // in this unknown list of attributes
  const { file, method, status, url, ...remainingData } = data;

  if (Object.keys(remainingData).length === 0) {
    return undefined;
  }

  return remainingData;
};
