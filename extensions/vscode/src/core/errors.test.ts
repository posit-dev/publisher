// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  createInvalidTOMLError,
  createSchemaValidationError,
  createConfigurationError,
} from "./errors";

describe("createInvalidTOMLError", () => {
  test("creates error with invalidTOML code", () => {
    const err = createInvalidTOMLError(
      "config.toml",
      "unexpected token",
      5,
      10,
    );
    expect(err.code).toBe("invalidTOML");
    expect(err.msg).toBe("unexpected token");
    expect(err.operation).toBe("parse");
    expect(err.data.problem).toBe("unexpected token");
    expect(err.data.file).toBe("config.toml");
    expect(err.data.line).toBe(5);
    expect(err.data.column).toBe(10);
  });
});

describe("createSchemaValidationError", () => {
  test("creates error with tomlValidationError code", () => {
    const err = createSchemaValidationError(
      "config.toml",
      "missing required field: type",
    );
    expect(err.code).toBe("tomlValidationError");
    expect(err.msg).toBe("missing required field: type");
    expect(err.operation).toBe("validate");
  });
});

describe("createConfigurationError", () => {
  test("combines error with location metadata", () => {
    const agentError = createInvalidTOMLError(
      "config.toml",
      "bad syntax",
      1,
      1,
    );
    const location = {
      configurationName: "myconfig",
      configurationPath: "/project/.posit/publish/myconfig.toml",
      configurationRelPath: ".posit/publish/myconfig.toml",
      projectDir: "/project",
    };

    const result = createConfigurationError(agentError, location);

    expect(result.error).toBe(agentError);
    expect(result.configurationName).toBe("myconfig");
    expect(result.configurationPath).toBe(
      "/project/.posit/publish/myconfig.toml",
    );
    expect(result.configurationRelPath).toBe(".posit/publish/myconfig.toml");
    expect(result.projectDir).toBe("/project");
  });
});
