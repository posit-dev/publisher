// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { CancellationToken, LanguageModelToolInvocationOptions } from "vscode";

// Minimal vscode result classes so the tool can construct its return value.
vi.mock("vscode", () => ({
  LanguageModelToolResult: class {
    constructor(public content: Array<{ value: string }>) {}
  },
  LanguageModelTextPart: class {
    constructor(public value: string) {}
  },
}));
// Stub every heavy module the tool imports so the real (ajv-importing) graph
// never loads during the unit test.
vi.mock("src/workspaces", () => ({ path: () => "/root" }));
vi.mock("src/state", () => ({ PublisherState: class {} }));
vi.mock("src/inspect", () => ({
  inspectProject: vi.fn(() => [
    {
      projectDir: ".",
      configuration: {
        type: "python-shiny",
        entrypoint: "app.py",
        title: "app",
      },
    },
  ]),
}));
vi.mock("src/interpreters", () => ({
  getInterpreterDefaults: vi.fn(() => ({
    python: {
      version: "3.11",
      packageFile: "requirements.txt",
      packageManager: "pip",
    },
    preferredPythonPath: "/usr/bin/python3",
    r: { version: "", packageFile: "", packageManager: "" },
    preferredRPath: "",
  })),
}));
vi.mock("src/toml", () => ({
  loadAllConfigurations: vi.fn(() => []),
  loadAllDeployments: vi.fn(() => []),
}));
vi.mock("src/api", () => ({
  isConfigurationError: () => false,
  isContentRecordError: () => false,
}));

import { GUID } from "@posit-dev/connect-api";
import { PlanDeploymentTool } from "./planDeploymentTool";
import { redactCredential } from "./redactCredential";
import { ServerType } from "src/api/types/contentRecords";

function parse(res: unknown) {
  const r = res as { content: Array<{ value: string }> };
  return JSON.parse(r.content[0]?.value ?? "{}");
}

describe("redactCredential", () => {
  test("keeps only name, url, serverType", () => {
    const out = redactCredential({
      guid: GUID("g"),
      name: "prod",
      url: "https://connect.example.com",
      apiKey: "SECRET",
      token: "SECRET",
      privateKey: "SECRET",
      refreshToken: "SECRET",
      accessToken: "SECRET",
      snowflakeConnection: "",
      accountId: "",
      accountName: "",
      cloudEnvironment: "",
      oauthClientId: "",
      tokenExpiresAt: "",
      serverType: ServerType.CONNECT,
    });
    expect(out).toEqual({
      name: "prod",
      url: "https://connect.example.com",
      serverType: ServerType.CONNECT,
    });
    expect(JSON.stringify(out)).not.toContain("SECRET");
  });
});

describe("PlanDeploymentTool", () => {
  const state = {
    credentialsService: {
      list: vi.fn(() => [
        {
          guid: GUID("g"),
          name: "prod",
          url: "https://c",
          apiKey: "SECRET",
          token: "",
          privateKey: "",
          refreshToken: "",
          accessToken: "",
          snowflakeConnection: "",
          accountId: "",
          accountName: "",
          cloudEnvironment: "",
          serverType: ServerType.CONNECT,
        },
      ]),
    },
  };

  beforeEach(() => vi.clearAllMocks());

  test("returns candidates and redacted credentials", async () => {
    // @ts-expect-error minimal PublisherState mock for the unit test
    const tool = new PlanDeploymentTool(state);
    const res = await tool.invoke(
      { input: { directory: "." } } as LanguageModelToolInvocationOptions<{
        directory?: string;
      }>,
      {} as CancellationToken,
    );
    const data = parse(res);
    expect(data.candidates[0].contentType).toBe("python-shiny");
    expect(data.credentials).toEqual([
      { name: "prod", url: "https://c", serverType: ServerType.CONNECT },
    ]);
    expect(JSON.stringify(data)).not.toContain("SECRET");
  });
});
