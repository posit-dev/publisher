// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { CancellationToken, LanguageModelToolInvocationOptions } from "vscode";
import { ContentType } from "src/api/types/configurations";
import { ServerType } from "src/api/types/contentRecords";

vi.mock("vscode", () => ({
  LanguageModelToolResult: class {
    constructor(public content: Array<{ value: string }>) {}
  },
  LanguageModelTextPart: class {
    constructor(public value: string) {}
  },
}));
vi.mock("src/workspaces", () => ({ path: () => "/root" }));
vi.mock("src/state", () => ({ PublisherState: class {} }));
vi.mock("src/views/homeView", () => ({ HomeViewProvider: class {} }));
vi.mock("src/inspect", () => ({
  inspectProject: vi.fn(async () => [
    {
      projectDir: ".",
      configuration: {
        type: ContentType.PYTHON_SHINY,
        entrypoint: "app.py",
        title: "app",
        files: ["/app.py"],
        validate: true,
      },
    },
  ]),
}));
vi.mock("src/toml", () => ({
  writeConfigToFile: vi.fn(async () => ({ configurationName: "app-ABCD" })),
  createDeploymentRecord: vi.fn(async () => ({
    deploymentName: "deployment-WXYZ",
  })),
  loadAllConfigurations: vi.fn(async () => []),
  loadAllDeployments: vi.fn(async () => []),
}));
vi.mock("src/api", () => ({
  isConfigurationError: () => false,
  isContentRecordError: () => false,
}));
vi.mock("src/utils/names", () => ({
  newConfigFileNameFromTitle: () => "app-ABCD",
  newDeploymentName: () => "deployment-WXYZ",
}));

import { DeployContentTool, DeployContentInput } from "./deployContentTool";

function makeTool(overrides: {
  credential?: unknown;
  credentialNames?: string[];
  deployOutcome?: unknown;
}) {
  const state = {
    findCredential: vi.fn(() => overrides.credential),
    credentialsService: {
      list: vi.fn(async () =>
        (overrides.credentialNames ?? []).map((name) => ({ name })),
      ),
    },
  };
  const homeView = {
    deployProject: vi.fn(async () => overrides.deployOutcome),
  };
  // @ts-expect-error minimal mocks for the unit test
  return new DeployContentTool(state, homeView, "9.9.9");
}
function opts(input: Partial<DeployContentInput>) {
  return {
    input,
  } as unknown as LanguageModelToolInvocationOptions<DeployContentInput>;
}
function parse(res: unknown) {
  const r = res as { content: Array<{ value: string }> };
  return JSON.parse(r.content[0]?.value ?? "{}");
}

beforeEach(() => vi.clearAllMocks());

describe("DeployContentTool", () => {
  test("returns needs-credential when the named credential is missing", async () => {
    const tool = makeTool({ credential: undefined, credentialNames: [] });
    const res = await tool.invoke(
      opts({ directory: ".", entrypoint: "app.py", credentialName: "nope" }),
      {} as CancellationToken,
    );
    expect(parse(res).status).toBe("needs-credential");
  });

  test("returns needs-content-type when detected type is unknown and none supplied", async () => {
    const { inspectProject } = await import("src/inspect");
    (
      inspectProject as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([
      {
        projectDir: ".",
        configuration: {
          type: ContentType.UNKNOWN,
          entrypoint: "app.py",
          title: "app",
          files: [],
          validate: true,
        },
      },
    ]);
    const tool = makeTool({
      credential: {
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
      },
    });
    const res = await tool.invoke(
      opts({ directory: ".", entrypoint: "app.py", credentialName: "prod" }),
      {} as CancellationToken,
    );
    expect(parse(res).status).toBe("needs-content-type");
  });

  test("deploys and returns success with URLs", async () => {
    const tool = makeTool({
      credential: {
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
        accountName: "",
      },
      deployOutcome: {
        status: "success",
        result: {
          contentId: "abc",
          dashboardUrl: "https://c/dash",
          directUrl: "https://c/d",
          logsUrl: "https://c/l",
          bundleId: "1",
        },
      },
    });
    const res = await tool.invoke(
      opts({
        directory: ".",
        entrypoint: "app.py",
        credentialName: "prod",
        title: "My App",
      }),
      {} as CancellationToken,
    );
    const data = parse(res);
    expect(data.status).toBe("success");
    expect(data.dashboardUrl).toBe("https://c/dash");
  });

  test("maps a failed outcome to a failed result", async () => {
    const tool = makeTool({
      credential: {
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
        accountName: "",
      },
      deployOutcome: { status: "failed", message: "boom" },
    });
    const res = await tool.invoke(
      opts({
        directory: ".",
        entrypoint: "app.py",
        credentialName: "prod",
        title: "My App",
      }),
      {} as CancellationToken,
    );
    const data = parse(res);
    expect(data.status).toBe("failed");
    expect(data.error).toContain("boom");
  });
});
