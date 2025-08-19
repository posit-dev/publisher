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

export const getMessageFromError = (error: unknown): string => {
  try {
    if (isAxiosErrorWithJson(error)) {
      return resolveAgentJsonErrorMsg(error);
    }
    if (axios.isAxiosError(error)) {
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
