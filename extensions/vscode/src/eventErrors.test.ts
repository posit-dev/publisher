// Copyright (C) 2024 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { EventStreamMessage } from "./api";
import {
  EventStreamMessageErrorCoded,
  isCodedEventErrorMessage,
  isEvtErrDeploymentFailed,
  isEvtErrRenvLockPackagesReadingFailed,
  handleEventCodedError,
} from "./eventErrors";
import { ErrorCode } from "./utils/errorTypes";

function mkEventStreamMsg(data: Record<PropertyKey, any>): EventStreamMessage;
function mkEventStreamMsg(
  data: Record<PropertyKey, any>,
  errCode: ErrorCode,
): EventStreamMessageErrorCoded;
function mkEventStreamMsg(data: Record<PropertyKey, any>, errCode?: ErrorCode) {
  const smsg: EventStreamMessage = {
    type: "publish/failure",
    time: "Tue Oct 01 2024 10:00:00 GMT-0600",
    data,
    error: "failed to publish",
  };
  if (errCode) {
    smsg.errCode = errCode;
  }
  return smsg;
}

describe("Event errors", () => {
  test("isCodedEventErrorMessage", () => {
    // Message without error code
    let streamMsg = mkEventStreamMsg({});
    let result = isCodedEventErrorMessage(streamMsg);
    expect(result).toBe(false);

    // Message with error code
    streamMsg = mkEventStreamMsg({}, "deployFailed");
    result = isCodedEventErrorMessage(streamMsg);
    expect(result).toBe(true);
  });

  test("isEvtErrDeploymentFailed", () => {
    // Message with another error code
    let streamMsg = mkEventStreamMsg({}, "unknown");
    let result = isEvtErrDeploymentFailed(streamMsg);
    expect(result).toBe(false);

    // Message with error code
    streamMsg = mkEventStreamMsg({}, "deployFailed");
    result = isEvtErrDeploymentFailed(streamMsg);
    expect(result).toBe(true);
  });

  test("isEvtErrRenvLockPackagesReadingFailed", () => {
    // Message with another error code
    let streamMsg = mkEventStreamMsg({}, "unknown");
    let result = isEvtErrRenvLockPackagesReadingFailed(streamMsg);
    expect(result).toBe(false);

    // Message with error code
    streamMsg = mkEventStreamMsg({}, "renvlockPackagesReadingError");
    result = isEvtErrRenvLockPackagesReadingFailed(streamMsg);
    expect(result).toBe(true);
  });

  test("handleEventCodedError", () => {
    const msgData = {
      dashboardUrl: "https://here.it.is/content/abcdefg",
      message: "Deployment failed - structured message from the agent",
      error: "A possum on the fridge",
    };
    let streamMsg = mkEventStreamMsg(msgData, "unknown");
    let resultMsg = handleEventCodedError(streamMsg);
    expect(resultMsg).toBe("A possum on the fridge");

    streamMsg = mkEventStreamMsg(msgData, "deployFailed");
    resultMsg = handleEventCodedError(streamMsg);
    expect(resultMsg).toBe(
      "Deployment failed - structured message from the agent",
    );

    msgData.message = "Could not scan R packages from renv lockfile";
    streamMsg = mkEventStreamMsg(msgData, "renvlockPackagesReadingError");
    resultMsg = handleEventCodedError(streamMsg);
    expect(resultMsg).toBe("Could not scan R packages from renv lockfile");
  });
});
