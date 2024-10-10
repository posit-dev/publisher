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

export const handleEventCodedError = (
  emsg: EventStreamMessageErrorCoded,
): string => {
  if (isEvtErrDeploymentFailed(emsg)) {
    return emsg.data.message;
  }

  if (isEvtErrRenvLockPackagesReadingFailed(emsg)) {
    return emsg.data.message;
  }

  const unknownErrMsg = emsg.data.error || emsg.data.message;
  return `Unknown error: ${unknownErrMsg}`;
};
