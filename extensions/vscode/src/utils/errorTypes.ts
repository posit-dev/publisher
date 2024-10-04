// Copyright (C) 2024 by Posit Software, PBC.

import { AxiosError, AxiosResponse, isAxiosError } from "axios";

export type ErrorCode =
  | "unknown"
  | "resourceNotFound"
  | "invalidTOML"
  | "unknownTOMLKey"
  | "invalidConfigFile"
  | "errorCertificateVerification"
  | "deployFailed";

export type axiosErrorWithJson<T = { code: ErrorCode; details: unknown }> =
  AxiosError & {
    response: AxiosResponse<T>;
  };

export const isAxiosErrorWithJson = (
  err: unknown,
): err is axiosErrorWithJson => {
  if (isAxiosError(err)) {
    return err.response?.data && err.response.data.code;
  }
  return false;
};

const isOfErrorType = (err: axiosErrorWithJson, code: ErrorCode): boolean => {
  return err.response.data.code === code;
};

type MkErrorDataType<T extends ErrorCode, D = Record<PropertyKey, never>> = {
  code: T;
  details: D;
};

const mkErrorTypeGuard = <T>(code: ErrorCode) => {
  return (err: unknown): err is axiosErrorWithJson<T> => {
    return isAxiosErrorWithJson(err) && isOfErrorType(err, code);
  };
};

// Unknown Errors
export type ErrUnknown = MkErrorDataType<
  "unknown",
  {
    error: string;
    data: Record<PropertyKey, any>;
  }
>;
export const isErrUnknown = mkErrorTypeGuard<ErrUnknown>("unknown");
export const errUnknownMessage = (err: axiosErrorWithJson<ErrUnknown>) => {
  const { error, data } = err.response.data.details;
  let msg = `Unknown publisher agent error: ${error}`;
  Object.keys(data).forEach((key) => {
    msg += `, ${key}=${data[key]}`;
  });
  return msg;
};

// Resource not found
export type ErrResourceNotFound = MkErrorDataType<
  "resourceNotFound",
  { resource: string }
>;
export const isErrResourceNotFound =
  mkErrorTypeGuard<ErrResourceNotFound>("resourceNotFound");

// Invalid TOML file(s)
export type ErrInvalidTOMLFile = MkErrorDataType<
  "invalidTOML",
  {
    filename: string;
    line: number;
    column: number;
  }
>;
export const isErrInvalidTOMLFile =
  mkErrorTypeGuard<ErrInvalidTOMLFile>("invalidTOML");
export const errInvalidTOMLMessage = (
  err: axiosErrorWithJson<ErrInvalidTOMLFile>,
) => {
  const { filename, line, column } = err.response.data.details;
  return `Invalid TOML file ${filename}:${line}:${column}`;
};

// Unknown key within a TOML file
export type ErrUnknownTOMLKey = MkErrorDataType<
  "unknownTOMLKey",
  {
    filename: string;
    line: number;
    column: number;
    key: string;
  }
>;
export const isErrUnknownTOMLKey =
  mkErrorTypeGuard<ErrUnknownTOMLKey>("unknownTOMLKey");
export const errUnknownTOMLKeyMessage = (
  err: axiosErrorWithJson<ErrUnknownTOMLKey>,
) => {
  const { filename, line, column, key } = err.response.data.details;
  return `Unknown field present in configuration file ${filename}:${line}:${column} - unknown key "${key}"`;
};

// Invalid configuration file(s)
export type ErrInvalidConfigFiles = MkErrorDataType<
  "invalidConfigFile",
  { filename: string }
>;
export const isErrInvalidConfigFile =
  mkErrorTypeGuard<ErrInvalidConfigFiles>("invalidConfigFile");

// Tries to match an Axios error that comes with an identifiable Json structured data
// defaulting to be ErrUnknown message when
export function resolveAgentJsonErrorMsg(err: axiosErrorWithJson) {
  if (isErrUnknownTOMLKey(err)) {
    return errUnknownTOMLKeyMessage(err);
  }

  if (isErrInvalidTOMLFile(err)) {
    return errInvalidTOMLMessage(err);
  }

  return errUnknownMessage(err as axiosErrorWithJson<ErrUnknown>);
}
