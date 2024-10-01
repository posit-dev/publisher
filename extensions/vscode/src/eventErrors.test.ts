// Copyright (C) 2024 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { EventStreamMessage } from "./api";
import {
  EventStreamMessageErrorCoded,
  isCodedEventErrorMessage,
  isEvtErrTargetNotFound,
  isEvtErrTargetForbidden,
  handleEventCodedError,
} from "./eventErrors";
import { ErrorCode } from "./utils/errorTypes";

const mkEventStreamMsg = (
  data = {},
  errCode?: ErrorCode,
): EventStreamMessage => {
  return {
    type: "publish/failure",
    time: "Tue Oct 01 2024 10:00:00 GMT-0600",
    data,
    errCode,
    error: "failed to publish",
  };
};

describe("Event errors", () => {
  test("isCodedEventErrorMessage", () => {
    // Message without error code
    let streamMsg = mkEventStreamMsg();
    let result = isCodedEventErrorMessage(streamMsg);
    expect(result).toBe(false);

    // Message with error code
    streamMsg = mkEventStreamMsg({}, "deploymentTargetNotFound");
    result = isCodedEventErrorMessage(streamMsg);
    expect(result).toBe(true);
  });

  test("isEvtErrTargetNotFound", () => {
    // Message with another error code
    let streamMsg = mkEventStreamMsg({}, "unknown");
    let result = isEvtErrTargetNotFound(
      streamMsg as EventStreamMessageErrorCoded,
    );
    expect(result).toBe(false);

    // Message with error code
    streamMsg = mkEventStreamMsg({}, "deploymentTargetNotFound");
    result = isEvtErrTargetNotFound(streamMsg as EventStreamMessageErrorCoded);
    expect(result).toBe(true);
  });

  test("isEvtErrTargetForbidden", () => {
    // Message with another error code
    let streamMsg = mkEventStreamMsg({}, "unknown");
    let result = isEvtErrTargetForbidden(
      streamMsg as EventStreamMessageErrorCoded,
    );
    expect(result).toBe(false);

    // Message with error code
    streamMsg = mkEventStreamMsg({}, "deploymentTargetIsForbidden");
    result = isEvtErrTargetForbidden(streamMsg as EventStreamMessageErrorCoded);
    expect(result).toBe(true);
  });

  test("handleEventCodedError", () => {
    const msgData = {
      dashboardUrl: "https://here.it.is/content/abcdefg",
      error: "A possum on the fridge",
    };
    let streamMsg = mkEventStreamMsg(msgData, "unknown");
    let resultMsg = handleEventCodedError(
      streamMsg as EventStreamMessageErrorCoded,
    );
    expect(resultMsg).toBe("Unknown error: A possum on the fridge");

    streamMsg = mkEventStreamMsg(msgData, "deploymentTargetNotFound");
    resultMsg = handleEventCodedError(
      streamMsg as EventStreamMessageErrorCoded,
    );
    expect(resultMsg).toBe(
      `Content at https://here.it.is/content/abcdefg could not be found. Please, verify the content "id" is accurate.`,
    );

    streamMsg = mkEventStreamMsg(msgData, "deploymentTargetIsForbidden");
    resultMsg = handleEventCodedError(
      streamMsg as EventStreamMessageErrorCoded,
    );
    expect(resultMsg).toBe(
      "You don't have enough permissions to deploy to https://here.it.is/content/abcdefg. Please, verify the credentials in use.",
    );
  });
});
