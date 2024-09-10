// Copyright (C) 2023 by Posit Software, PBC.

import axios, { AxiosError, AxiosResponse } from "axios";

export type ErrorMessage = string[];
export type ErrorMessages = ErrorMessage[];

export type ErrorResData = {
  code: string;
  status: number;
  msg: string;
  error: string;
};

export type JsonErrorResponse = AxiosError & {
  response: AxiosResponse<ErrorResData>;
};

export const isJsonErrorRes = (error: unknown): error is JsonErrorResponse => {
  if (axios.isAxiosError(error)) {
    return error.response?.data && typeof error.response.data === "object";
  }
  return false;
};

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
  return undefined;
};

export const getMessageFromError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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

// When the error is a known JSON agent error it returns it's message.
// Otherwise, a tracing message is returned to help diagnose.
export const getSummaryStringFromError = (location: string, error: unknown) => {
  let msg = `An error has occurred at ${location}`;

  if (isJsonErrorRes(error)) {
    return error.response.data.msg;
  }

  const summary = getSummaryFromError(error);
  if (summary) {
    if (summary.status) {
      msg += `, Status=${summary.status}`;
    }
    if (summary.statusText) {
      msg += `, StatusText=${summary.statusText}`;
    }
    if (summary.code) {
      msg += `, Code=${summary.code}`;
    }
    if (summary.msg) {
      msg += `, Msg=${summary.msg}`;
    }
    if (summary.baseURL || summary.method || summary.url) {
      msg += `, URL=${summary.baseURL}/${summary.method}/${summary.url}`;
    }
  } else {
    msg += `, Error=${error}`;
  }
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
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-shadow
    file,
    method,
    status,
    url,
    ...remainingData
  } = data;

  if (Object.keys(remainingData).length === 0) {
    return undefined;
  }

  return remainingData;
};
