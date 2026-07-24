// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { CancellationToken, LanguageModelToolInvocationOptions } from "vscode";

// vi.mock is hoisted above module scope, so the mocked fn must be created via
// vi.hoisted to be available inside the factory.
const { executeCommand } = vi.hoisted(() => ({
  executeCommand: vi.fn(async () => undefined),
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

import { AddCredentialTool } from "./addCredentialTool";

beforeEach(() => vi.clearAllMocks());

describe("AddCredentialTool", () => {
  test("invokes the credential-creation command and reports initiated", async () => {
    const tool = new AddCredentialTool();
    const res = await tool.invoke(
      { input: {} } as LanguageModelToolInvocationOptions<
        Record<string, never>
      >,
      {} as CancellationToken,
    );
    expect(executeCommand).toHaveBeenCalledWith(
      "posit.publisher.homeView.addCredential",
    );
    const r = res as unknown as { content: Array<{ value: string }> };
    expect(JSON.parse(r.content[0]?.value ?? "{}").status).toBe("initiated");
  });
});
