// Copyright (C) 2024 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { getSummaryStringFromError } from "./errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mkAxiosJsonErr = (data: Record<PropertyKey, any>) => {
  return new AxiosError(undefined, undefined, undefined, undefined, {
    status: 0,
    statusText: "",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  });
};

describe("getSummaryStringFromError", () => {
  describe("known JSON errors", () => {
    test("returns a user friendly message", () => {
      // Just testing the summary for a couple errors, the whole error types messages matrix should be tested at errorTypes.test.ts
      let summary = getSummaryStringFromError(
        "callerMethodHere",
        mkAxiosJsonErr({
          code: "invalidTOML",
          details: {
            filename: "/directory/configuration-lkdg.toml",
            line: 5,
            column: 5,
          },
        }),
      );

      expect(summary).toBe("The Configuration has a schema error on line 5");

      summary = getSummaryStringFromError(
        "callerMethodHere",
        mkAxiosJsonErr({
          code: "unknownTOMLKey",
          details: {
            filename: "/directory/configuration-lkdg.toml",
            line: 7,
            column: 1,
            key: "shortcut_key",
          },
        }),
      );

      expect(summary).toBe(`The Configuration has a schema error on line 7`);
    });
  });

  describe("Axios errors", () => {
    test("Axios Error #1", () => {
      const summary = getSummaryStringFromError(
        "callerMethodHere",
        new AxiosError("Bad Error", undefined, undefined, undefined, {
          status: 400,
          statusText: "Bad Request",
          headers: new AxiosHeaders(),
          config: { headers: new AxiosHeaders(), baseURL: "localhost:9874" },
          data: undefined,
        }),
      );
      expect(summary).toBe("Bad Error");
    });
    test("Axios Error #2", () => {
      const summary = getSummaryStringFromError(
        "callerMethodHere",
        new AxiosError(
          "Bricks are falling",
          "CODE_WHOOPS",
          undefined,
          undefined,
          {
            status: 400,
            statusText: "Bad Request",
            headers: new AxiosHeaders(),
            config: { headers: new AxiosHeaders(), baseURL: "localhost:9874" },
            data: undefined,
          },
        ),
      );
      expect(summary).toBe("Bricks are falling");
    });
    test("Axios Error #3", () => {
      const readOnlyError = new AxiosError(
        "Request failed with status code 500",
        "ERR_BAD_RESPONSE",
        undefined,
        undefined,
        {
          status: 500,
          statusText: "Bad Request",
          headers: new AxiosHeaders(),
          config: { headers: new AxiosHeaders(), baseURL: "localhost:9874" },
          data: "open /Users/billsager/dev/publishing-client/test/sample-content/shinyapp/.posit/publish/shinyapp-file-check-DUQ4.toml: operation not permitted",
        },
      );
      const summary = getSummaryStringFromError(
        "callerMethodHere",
        readOnlyError,
      );
      expect(summary).toBe(
        "open /Users/billsager/dev/publishing-client/test/sample-content/shinyapp/.posit/publish/shinyapp-file-check-DUQ4.toml: operation not permitted",
      );
    });
  });
});
describe("Unknown errors", () => {
  test("Non-error Object", () => {
    const summary = getSummaryStringFromError("callerMethodHere", {
      problem: "oops",
      data: "stuff",
    });
    expect(summary).toBe("Unknown Error");
  });
});
