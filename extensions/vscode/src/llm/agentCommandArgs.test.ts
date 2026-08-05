// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { normalizeAgentCommandArgs } from "./agentCommandArgs";

interface DeployArgs {
  directory?: string;
  entrypoint?: string;
  credentialName?: string;
  title?: string;
}

const argNames = ["directory", "entrypoint", "credentialName", "title"];

describe("normalizeAgentCommandArgs", () => {
  test("passes a single object argument through unchanged", () => {
    const input = {
      directory: "test-app",
      entrypoint: "app.py",
      credentialName: "prod",
    };

    expect(normalizeAgentCommandArgs<DeployArgs>([input], argNames)).toEqual(
      input,
    );
  });

  test("maps positional arguments onto the declared names in order", () => {
    const result = normalizeAgentCommandArgs<DeployArgs>(
      ["test-app", "app.py", "prod", "Test App"],
      argNames,
    );

    expect(result).toEqual({
      directory: "test-app",
      entrypoint: "app.py",
      credentialName: "prod",
      title: "Test App",
    });
  });

  test("omits keys for trailing positional arguments that weren't supplied", () => {
    const result = normalizeAgentCommandArgs<DeployArgs>(
      ["test-app", "app.py"],
      argNames,
    );

    expect(result).toEqual({
      directory: "test-app",
      entrypoint: "app.py",
    });
  });

  test("returns an empty object when called with no arguments", () => {
    expect(normalizeAgentCommandArgs<DeployArgs>([], argNames)).toEqual({});
  });

  test("treats a single non-object positional value as positional, not the object form", () => {
    const result = normalizeAgentCommandArgs<{ directory?: string }>(
      ["test-app"],
      ["directory"],
    );

    expect(result).toEqual({ directory: "test-app" });
  });
});
