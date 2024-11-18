// Copyright (C) 2024 by Posit Software, PBC.

import { EventStreamMessage } from "./api/types/events";
import { ErrorCode } from "./utils/errorTypes";

export interface EventStreamMessageErrorCoded<T = Record<string, string>>
  extends EventStreamMessage<T> {
  errCode: ErrorCode;
}

export function isCodedEventErrorMessage(
  msg: EventStreamMessage,
): msg is EventStreamMessageErrorCoded {
  return msg.errCode !== undefined;
}

type baseEvtErr = {
  dashboardUrl: string;
  localId: string;
  message: string;
  error: string;
};

type lockfileReadingEvtErr = baseEvtErr & {
  lockfile: string;
};

type requirementsReadingEvtErr = baseEvtErr & {
  requirementsFile: string;
};

type renvPackageEvtErr = baseEvtErr & {
  lockfile: string;
  package: string;
  lockfileVersion: string;
  libraryVersion: string;
};

export const isEvtErrDeploymentFailed = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<baseEvtErr> => {
  return emsg.errCode === "deployFailed";
};

export const isEvtErrRenvLockPackagesReadingFailed = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<lockfileReadingEvtErr> => {
  return emsg.errCode === "renvlockPackagesReadingError";
};

export const isEvtErrRenvPackageVersionMismatch = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<renvPackageEvtErr> => {
  return emsg.errCode === "renvPackageVersionMismatch";
};

export const isEvtErrRenvPackageSourceMissing = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<renvPackageEvtErr> => {
  return emsg.errCode === "renvPackageSourceMissing";
};

export const isEvtErrRequirementsReadingFailed = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<requirementsReadingEvtErr> => {
  return emsg.errCode === "requirementsFileReadingError";
};

export const isEvtErrDeployedContentNotRunning = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<baseEvtErr> => {
  return emsg.errCode === "deployedContentNotRunning";
};

export const useEvtErrKnownMessage = (
  emsg: EventStreamMessageErrorCoded,
): boolean => {
  return (
    isEvtErrDeploymentFailed(emsg) ||
    isEvtErrRenvLockPackagesReadingFailed(emsg) ||
    isEvtErrRenvPackageVersionMismatch(emsg) ||
    isEvtErrRenvPackageSourceMissing(emsg) ||
    isEvtErrRequirementsReadingFailed(emsg) ||
    isEvtErrDeployedContentNotRunning(emsg)
  );
};

export const handleEventCodedError = (
  emsg: EventStreamMessageErrorCoded,
): string => {
  if (useEvtErrKnownMessage(emsg)) {
    return emsg.data.message;
  }

  return emsg.data.error || emsg.data.message;
};
