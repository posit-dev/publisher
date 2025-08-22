// Copyright (C) 2024 by Posit Software, PBC.

import { AxiosError, AxiosResponse, isAxiosError } from "axios";

export type ErrorCode =
  | "unknown"
  | "resourceNotFound"
  | "invalidTOML"
  | "unknownTOMLKey"
  | "invalidConfigFile"
  | "errorCertificateVerification"
  | "deployFailed"
  | "renvPackageVersionMismatch"
  | "renvPackageSourceMissing"
  | "renvlockPackagesReadingError"
  | "renvPackageNotInstalledError"
  | "renvActionRequiredError"
  | "requirementsFileReadingError"
  | "deployedContentNotRunning"
  | "tomlValidationError"
  | "tomlUnknownError"
  | "pythonExecNotFound"
  | "credentialsCannotBackupFile"
  | "credentialsCorrupted"
  | "deviceAuthAccessDenied"
  | "deviceAuthExpiredToken";

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
    data: Record<PropertyKey, unknown>;
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
export type ErrTOMLValidationError = MkErrorDataType<
  "tomlValidationError",
  {
    filename: string;
    message: string;
    key: string;
    problem: string;
    schemaReference: string;
  }
>;
export const isErrTOMLValidationError =
  mkErrorTypeGuard<ErrTOMLValidationError>("tomlValidationError");
export const errTOMLValidationErrorMessage = (
  err: axiosErrorWithJson<ErrTOMLValidationError>,
) => {
  return `The Configuration has a schema error: ${err.response.data.details.message}`;
};

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
  return `The Configuration has a schema error on line ${err.response.data.details.line}`;
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
  return `The Configuration has a schema error on line ${err.response.data.details.line}`;
};

// Unknown error within a TOML file
export type ErrTomlUnknownError = MkErrorDataType<
  "tomlUnknownError",
  {
    filename: string;
    problem: string;
  }
>;
export const isErrTomlUnknownError =
  mkErrorTypeGuard<ErrTomlUnknownError>("tomlUnknownError");
export const errTomlUnknownErrorMessage = (
  _: axiosErrorWithJson<ErrTomlUnknownError>,
) => {
  return `The Configuration has a schema error`;
};

// Python executable not found
export type ErrPythonExecNotFoundError = MkErrorDataType<"pythonExecNotFound">;
export const isErrPythonExecNotFoundError =
  mkErrorTypeGuard<ErrPythonExecNotFoundError>("pythonExecNotFound");
export const errPythonExecNotFoundErrorMessage = (
  _: axiosErrorWithJson<ErrPythonExecNotFoundError>,
) => {
  return "Could not find a Python executable.";
};

// Invalid configuration file(s)
export type ErrInvalidConfigFiles = MkErrorDataType<
  "invalidConfigFile",
  { filename: string }
>;
export const isErrInvalidConfigFile =
  mkErrorTypeGuard<ErrInvalidConfigFiles>("invalidConfigFile");

// Invalid configuration file(s)
export type ErrCredentialsCorrupted = MkErrorDataType<"credentialsCorrupted">;
export const isErrCredentialsCorrupted =
  mkErrorTypeGuard<ErrCredentialsCorrupted>("credentialsCorrupted");
export const errCredentialsCorruptedMessage = (backupFile: string) => {
  let msg =
    "Unrecognizable credentials for Posit Publisher were found and removed. Credentials may need to be recreated.";
  if (backupFile) {
    msg += ` Previous credentials data backed up at ${backupFile}`;
  }
  return msg;
};

// Unable to backup credentials file
export type ErrCannotBackupCredentialsFile = MkErrorDataType<
  "credentialsCannotBackupFile",
  { filename: string; message: string }
>;
export const isErrCannotBackupCredentialsFile =
  mkErrorTypeGuard<ErrCannotBackupCredentialsFile>(
    "credentialsCannotBackupFile",
  );
export const errCannotBackupCredentialsFileMessage = (
  err: axiosErrorWithJson<ErrCannotBackupCredentialsFile>,
) => {
  return `Unrecognizable credentials for Posit Publisher were found. ${err.response.data.details.message}`;
};

// Device auth access denied error
export type ErrDeviceAuthAccessDenied =
  MkErrorDataType<"deviceAuthAccessDenied">;
export const isErrDeviceAuthAccessDenied =
  mkErrorTypeGuard<ErrDeviceAuthAccessDenied>("deviceAuthAccessDenied");
export const errDeviceAuthAccessDeniedMessage =
  "The authorization request was denied.";

// Device auth expired token error
export type ErrDeviceAuthExpiredToken =
  MkErrorDataType<"deviceAuthExpiredToken">;
export const isDeviceAuthExpiredToken =
  mkErrorTypeGuard<ErrDeviceAuthExpiredToken>("deviceAuthExpiredToken");
export const errDeviceAuthExpiredTokenMessage =
  "Your authorization session has expired.";

// Tries to match an Axios error that comes with an identifiable Json structured data
// defaulting to be ErrUnknown message when
export function resolveAgentJsonErrorMsg(err: axiosErrorWithJson) {
  if (isErrUnknownTOMLKey(err)) {
    return errUnknownTOMLKeyMessage(err);
  }

  if (isErrInvalidTOMLFile(err)) {
    return errInvalidTOMLMessage(err);
  }

  if (isErrTOMLValidationError(err)) {
    return errTOMLValidationErrorMessage(err);
  }

  if (isErrTomlUnknownError(err)) {
    return errTomlUnknownErrorMessage(err);
  }

  if (isErrPythonExecNotFoundError(err)) {
    return errPythonExecNotFoundErrorMessage(err);
  }

  if (isErrDeviceAuthAccessDenied(err)) {
    return errDeviceAuthAccessDeniedMessage;
  }

  if (isDeviceAuthExpiredToken(err)) {
    return errDeviceAuthExpiredTokenMessage;
  }

  return errUnknownMessage(err as axiosErrorWithJson<ErrUnknown>);
}
