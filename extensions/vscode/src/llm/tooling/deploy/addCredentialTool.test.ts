// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.mock is hoisted above module scope, so the mocked fn must be created via
// vi.hoisted to be available inside the factory.
const { executeCommand } = vi.hoisted(() => ({
  executeCommand: vi.fn(
    (): Promise<{
      status: string;
      credentialName?: string;
      reason?: string;
    }> => Promise.resolve({ status: "canceled" }),
  ),
}));
vi.mock("vscode", () => ({
  commands: { executeCommand },
  LanguageModelToolResult: class {
    constructor(public content: Array<{ value: string }>) {}
  },
  LanguageModelTextPart: class {
    constructor(public value: string) {}
  },
}));

import { AddCredentialTool, AddCredentialInput } from "./addCredentialTool";

function run(tool: AddCredentialTool, input: AddCredentialInput) {
  return tool.run(input);
}

beforeEach(() => vi.clearAllMocks());

describe("AddCredentialTool", () => {
  test("with no context, opens the UI fully manual and reports the outcome", async () => {
    const tool = new AddCredentialTool();
    const res = await run(tool, {});
    expect(executeCommand).toHaveBeenCalledWith(
      "posit.publisher.homeView.addCredential",
      undefined,
      undefined,
      undefined,
      true,
    );
    expect(res).toEqual({
      status: "canceled",
      message:
        "The user canceled credential creation. Ask them how they'd like to proceed.",
    });
  });

  test("a serverUrl alone is a hint to target Connect and sign in via browser", async () => {
    const tool = new AddCredentialTool();
    await run(tool, { serverUrl: "https://connect.example.com" });
    expect(executeCommand).toHaveBeenCalledWith(
      "posit.publisher.homeView.addCredential",
      "https://connect.example.com",
      "connect",
      "browser",
      true,
    );
  });

  test("an explicit apiKey request keeps auth manual", async () => {
    const tool = new AddCredentialTool();
    await run(tool, {
      serverUrl: "https://connect.example.com",
      authMethod: "apiKey",
    });
    expect(executeCommand).toHaveBeenCalledWith(
      "posit.publisher.homeView.addCredential",
      "https://connect.example.com",
      "connect",
      "apiKey",
      true,
    );
  });

  test("target connect without a serverUrl preselects the platform but does not auto sign in", async () => {
    const tool = new AddCredentialTool();
    await run(tool, { target: "connect" });
    expect(executeCommand).toHaveBeenCalledWith(
      "posit.publisher.homeView.addCredential",
      undefined,
      "connect",
      undefined,
      true,
    );
  });

  test("target connect-cloud preselects the platform and ignores auth method hints", async () => {
    const tool = new AddCredentialTool();
    await run(tool, { target: "connect-cloud", authMethod: "apiKey" });
    expect(executeCommand).toHaveBeenCalledWith(
      "posit.publisher.homeView.addCredential",
      undefined,
      "connect_cloud",
      undefined,
      true,
    );
  });

  test("reports when the requested platform is unavailable (e.g. Connect Cloud disabled)", async () => {
    executeCommand.mockResolvedValueOnce({
      status: "unavailable",
      reason:
        "Posit Connect Cloud is not available. It may be disabled in settings.",
    });
    const tool = new AddCredentialTool();
    const res = await run(tool, { target: "connect-cloud" });
    expect(res).toEqual({
      status: "unavailable",
      message:
        "Posit Connect Cloud is not available. It may be disabled in settings.",
    });
  });

  test("reports the added credential name so the caller can continue automatically", async () => {
    executeCommand.mockResolvedValueOnce({
      status: "added",
      credentialName: "prod",
    });
    const tool = new AddCredentialTool();
    const res = await run(tool, {});
    expect(res).toEqual({
      status: "added",
      credentialName: "prod",
      message: 'Credential "prod" was added. Continue the deployment now.',
    });
  });
});
