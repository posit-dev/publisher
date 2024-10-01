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

type deploymentEvtErr = {
  dashboardUrl: string;
  localId: string;
  error: string;
};

export const isEvtErrTargetNotFound = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<deploymentEvtErr> => {
  return emsg.errCode === "deploymentTargetNotFound";
};

export const isEvtErrTargetForbidden = (
  emsg: EventStreamMessageErrorCoded,
): emsg is EventStreamMessageErrorCoded<deploymentEvtErr> => {
  return emsg.errCode === "deploymentTargetIsForbidden";
};

export const handleEventCodedError = (
  emsg: EventStreamMessageErrorCoded,
): string => {
  if (isEvtErrTargetNotFound(emsg)) {
    return `Content at ${emsg.data.dashboardUrl} could not be found. Please, verify the content "id" is accurate.`;
  }
  if (isEvtErrTargetForbidden(emsg)) {
    return `You don't have enough permissions to deploy to ${emsg.data.dashboardUrl}. Please, verify the credentials in use.`;
  }
  const unknownErrMsg = emsg.data.error || emsg.data.message;
  return `Unknown error: ${unknownErrMsg}`;
};
