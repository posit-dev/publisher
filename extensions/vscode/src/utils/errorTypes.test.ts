// Copyright (C) 2024 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  axiosErrorWithJson,
  ErrUnknown,
  isErrUnknown,
  errUnknownMessage,
  isErrResourceNotFound,
  ErrInvalidTOMLFile,
  isErrInvalidTOMLFile,
  errInvalidTOMLMessage,
  ErrUnknownTOMLKey,
  isErrUnknownTOMLKey,
  errUnknownTOMLKeyMessage,
  isErrInvalidConfigFile,
  resolveAgentJsonErrorMsg,
} from "./errorTypes";

const mkAxiosJsonErr = (data: Record<PropertyKey, any>) => {
  return new AxiosError(undefined, undefined, undefined, undefined, {
    status: 0,
    statusText: "",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  });
};

describe("ErrUnknown", () => {
  test("isErrUnknown", () => {
    let result = isErrUnknown(
      mkAxiosJsonErr({
        code: "unknown",
      }),
    );

    expect(result).toBe(true);

    result = isErrUnknown(
      mkAxiosJsonErr({
        code: "bricks_raining",
      }),
    );

    expect(result).toBe(false);
  });

  test("errUnknownMessage", () => {
    const err = mkAxiosJsonErr({
      code: "unknown",
      details: {
        error: "oh nooo!",
        data: {
          trace: "a > b > c > d",
        },
      },
    });

    const msg = errUnknownMessage(err as axiosErrorWithJson<ErrUnknown>);
    expect(msg).toBe(
      "Unknown publisher agent error: oh nooo!, trace=a > b > c > d",
    );
  });
});

describe("ErrResourceNotFound", () => {
  test("isErrResourceNotFound", () => {
    let result = isErrResourceNotFound(
      mkAxiosJsonErr({
        code: "resourceNotFound",
      }),
    );

    expect(result).toBe(true);

    result = isErrResourceNotFound(
      mkAxiosJsonErr({
        code: "bricks_raining",
      }),
    );

    expect(result).toBe(false);
  });
});

describe("ErrInvalidTOMLFile", () => {
  test("isErrInvalidTOMLFile", () => {
    let result = isErrInvalidTOMLFile(
      mkAxiosJsonErr({
        code: "invalidTOML",
      }),
    );

    expect(result).toBe(true);

    result = isErrInvalidTOMLFile(
      mkAxiosJsonErr({
        code: "bricks_raining",
      }),
    );

    expect(result).toBe(false);
  });

  test("errInvalidTOMLMessage", () => {
    const err = mkAxiosJsonErr({
      code: "invalidTOML",
      details: {
        filename: "/directory/configuration-lkdg.toml",
        line: 5,
        column: 5,
      },
    });

    const msg = errInvalidTOMLMessage(
      err as axiosErrorWithJson<ErrInvalidTOMLFile>,
    );
    expect(msg).toBe("The Configuration has a schema error on line 5");
  });
});

describe("ErrUnknownTOMLKey", () => {
  test("isErrUnknownTOMLKey", () => {
    let result = isErrUnknownTOMLKey(
      mkAxiosJsonErr({
        code: "unknownTOMLKey",
      }),
    );

    expect(result).toBe(true);

    result = isErrUnknownTOMLKey(
      mkAxiosJsonErr({
        code: "bricks_raining",
      }),
    );

    expect(result).toBe(false);
  });

  test("errUnknownTOMLKeyMessage", () => {
    const err = mkAxiosJsonErr({
      code: "unknownTOMLKey",
      details: {
        filename: "/directory/configuration-lkdg.toml",
        line: 7,
        column: 1,
        key: "shortcut_key",
      },
    });

    const msg = errUnknownTOMLKeyMessage(
      err as axiosErrorWithJson<ErrUnknownTOMLKey>,
    );
    expect(msg).toBe(`The Configuration has a schema error on line 7`);
  });
});

describe("ErrInvalidConfigFiles", () => {
  test("isErrInvalidConfigFile", () => {
    let result = isErrInvalidConfigFile(
      mkAxiosJsonErr({
        code: "invalidConfigFile",
      }),
    );

    expect(result).toBe(true);

    result = isErrInvalidConfigFile(
      mkAxiosJsonErr({
        code: "bricks_raining",
      }),
    );

    expect(result).toBe(false);
  });
});

describe("resolveAgentJsonErrorMsg", () => {
  test("returns proper message based on the provided error", () => {
    let msg = resolveAgentJsonErrorMsg(
      mkAxiosJsonErr({
        code: "unknown",
        details: {
          error: "oh nooo!",
          data: {
            trace: "a > b > c > d",
          },
        },
      }) as axiosErrorWithJson,
    );

    expect(msg).toBe(
      "Unknown publisher agent error: oh nooo!, trace=a > b > c > d",
    );

    msg = resolveAgentJsonErrorMsg(
      mkAxiosJsonErr({
        code: "invalidTOML",
        details: {
          filename: "/directory/configuration-lkdg.toml",
          line: 5,
          column: 5,
        },
      }) as axiosErrorWithJson,
    );

    expect(msg).toBe("The Configuration has a schema error on line 5");

    msg = resolveAgentJsonErrorMsg(
      mkAxiosJsonErr({
        code: "unknownTOMLKey",
        details: {
          filename: "/directory/configuration-lkdg.toml",
          line: 7,
          column: 1,
          key: "shortcut_key",
        },
      }) as axiosErrorWithJson,
    );

    expect(msg).toBe(`The Configuration has a schema error on line 7`);
  });
});
