// Copyright (C) 2024 by Posit Software, PBC.

import { vi, describe, expect, test } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import * as errtypes from "./errorTypes";
import { getSummaryStringFromError } from "./errors";

const spyIsAxiosErrorWithJson = vi.spyOn(errtypes, "isAxiosErrorWithJson");
const spyResolveAgentJsonErrorMsg = vi.spyOn(
  errtypes,
  "resolveAgentJsonErrorMsg",
);

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

      expect(summary).toBe(
        "Invalid TOML file /directory/configuration-lkdg.toml:5:5",
      );

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

      expect(summary).toBe(
        `Unknown field present in configuration file /directory/configuration-lkdg.toml:7:1 - unknown key "shortcut_key"`,
      );
    });
  });

  describe("unknown or unregistered errors", () => {
    test("returns a summary of available data", () => {
      let summary = getSummaryStringFromError(
        "callerMethodHere",
        new AxiosError(undefined, undefined, undefined, undefined, {
          status: 400,
          statusText: "Bad Request",
          headers: new AxiosHeaders(),
          config: { headers: new AxiosHeaders(), baseURL: "localhost:9874" },
          data: undefined,
        }),
      );

      expect(summary).toBe(
        "An error has occurred at callerMethodHere, Status=400, StatusText=Bad Request",
      );

      summary = getSummaryStringFromError(
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

      expect(summary).toBe(
        "An error has occurred at callerMethodHere, Status=400, StatusText=Bad Request, Code=CODE_WHOOPS, Msg=Bricks are falling",
      );
    });
  });
});
