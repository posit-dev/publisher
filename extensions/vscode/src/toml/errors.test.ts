// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import {
  createInvalidTOMLError,
  createSchemaValidationError,
  createConfigurationError,
} from "./errors";

describe("error factories", () => {
  it("creates an invalidTOML error", () => {
    const err = createInvalidTOMLError(
      "/path/to/file.toml",
      "unexpected '='",
      5,
      10,
    );
    expect(err.code).toBe("invalidTOML");
    expect(err.msg).toContain("/path/to/file.toml");
    expect(err.msg).toContain("unexpected '='");
    expect(err.operation).toBe("config.loadFromFile");
  });

  it("creates a schema validation error", () => {
    const err = createSchemaValidationError(
      "/path/to/file.toml",
      "missing required field",
    );
    expect(err.code).toBe("tomlValidationError");
    expect(err.msg).toContain("missing required field");
    expect(err.operation).toBe("config.loadFromFile");
  });

  it("creates a ConfigurationError with location", () => {
    const agentErr = createInvalidTOMLError("/p/file.toml", "bad", 1, 1);
    const location = {
      configurationName: "file",
      configurationPath: "/p/file.toml",
      projectDir: "/p",
    };
    const cfgErr = createConfigurationError(agentErr, location);
    expect(cfgErr.error).toBe(agentErr);
    expect(cfgErr.configurationName).toBe("file");
    expect(cfgErr.configurationPath).toBe("/p/file.toml");
    expect(cfgErr.projectDir).toBe("/p");
  });
});
