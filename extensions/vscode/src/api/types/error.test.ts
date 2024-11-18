// Copyright (C) 2024 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  isAgentErrorTypeUnknown,
  isAgentErrorInvalidTOML,
  isAgentErrorDeployedContentNotRunning,
} from "./error";

describe("Agent Errors", () => {
  test("isAgentErrorTypeUnknown", () => {
    let result = isAgentErrorTypeUnknown({
      code: "unknown",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(true);

    result = isAgentErrorTypeUnknown({
      code: "resourceNotFound",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(true);

    result = isAgentErrorTypeUnknown({
      code: "unknownTOMLKey",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(false);

    result = isAgentErrorTypeUnknown({
      code: "invalidTOML",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(false);

    result = isAgentErrorTypeUnknown({
      code: "deployedContentNotRunning",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(false);
  });

  test("isAgentErrorInvalidTOML", () => {
    let result = isAgentErrorInvalidTOML({
      code: "unknown",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(false);

    result = isAgentErrorInvalidTOML({
      code: "unknownTOMLKey",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(true);

    result = isAgentErrorInvalidTOML({
      code: "invalidTOML",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(true);
  });

  test("isAgentErrorDeployedContentNotRunning", () => {
    let result = isAgentErrorDeployedContentNotRunning({
      code: "unknown",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(false);

    result = isAgentErrorDeployedContentNotRunning({
      code: "deployedContentNotRunning",
      msg: "",
      operation: "",
      data: {},
    });
    expect(result).toBe(true);
  });
});
