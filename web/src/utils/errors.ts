// Copyright (C) 2023 by Posit Software, PBC.

import axios from 'axios';
import { RouteLocationRaw } from 'vue-router';

export type ErrorMessage = string[];
export type ErrorMessages = ErrorMessage[];

export const getStatusFromError = (error: unknown) : (number | undefined) => {
  if (axios.isAxiosError(error)) {
    return error.status;
  }
  return undefined;
};

export const getCodeStringFromError = (error: unknown) : (string | undefined) => {
  if (axios.isAxiosError(error)) {
    return error.code;
  }
  return undefined;
};

export const getMessageFromError = (error: unknown) : string => {
  if (axios.isAxiosError(error) || error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const buildErrorBannerMessage = (errorMsg: string, resolveMsg: string) => {
  return [
    'An error has been detected:',
    errorMsg,
    resolveMsg,
  ];
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

export const getSummaryFromError = (error: unknown) => {
  const stat = getStatusFromError(error);
  const code = getCodeStringFromError(error);
  const msg = getMessageFromError(error);
  const url = getAPIURLFromError(error);

  if (stat || code || msg || url) {
    return {
      status: stat,
      code,
      msg,
      ...url,
    };
  }
  return undefined;
};

export const checkForResponseWithStatus = (error: unknown, statusValue: number) => {
  const errorStatus = getStatusFromError(error);
  return errorStatus === statusValue;
};

export const newFatalErrorRouteLocation =
  (error: unknown, locationHint: string): RouteLocationRaw => {
    const info = getSummaryFromError(error);
    return {
      name: 'fatalError',
      query: {
        location: locationHint,
        stat: info?.status,
        code: info?.code,
        msg: info?.msg,
        baseURL: info?.baseURL,
        method: info?.method,
        url: info?.url,
      },
    };
  };

export const scrubErrorData = (data: Record<string, unknown> | undefined) => {
  if (!data) {
    return undefined;
  }
  // remove what we don't want to display
  // in this unknown list of attributes
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-shadow
    file, method, status, url,
    ...remainingData
  } = data;

  if (Object.keys(remainingData).length === 0) {
    return undefined;
  }

  return remainingData;
};
