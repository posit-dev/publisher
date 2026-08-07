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
vi.mock("src/workspaces", async (importOriginal) => {
  const actual = await importOriginal<typeof import("src/workspaces")>();
  return { ...actual, path: () => "/root" };
});
vi.mock("src/state", () => ({ PublisherState: class {} }));
vi.mock("src/views/homeView", () => ({ HomeViewProvider: class {} }));
vi.mock("src/inspect", () => ({
  inspectProject: vi.fn(() => [
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
  writeConfigToFile: vi.fn(() => ({ configurationName: "app-ABCD" })),
  createDeploymentRecord: vi.fn(() => ({
    deploymentName: "deployment-WXYZ",
  })),
  loadAllConfigurations: vi.fn(() => []),
  loadAllDeployments: vi.fn(() => []),
  loadConfiguration: vi.fn(),
}));
vi.mock("src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("src/api")>();
  return {
    ...actual,
    isConfigurationError: () => false,
    isContentRecordError: () => false,
  };
});
vi.mock("src/utils/names", () => ({
  newConfigFileNameFromTitle: () => "app-ABCD",
  newDeploymentName: () => "deployment-WXYZ",
}));
const { enableConnectCloud } = vi.hoisted(() => ({
  enableConnectCloud: vi.fn(() => true),
}));
vi.mock("src/extension", () => ({
  extensionSettings: { enableConnectCloud },
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
      list: vi.fn(() =>
        (overrides.credentialNames ?? []).map((name) => ({ name })),
      ),
    },
  };
  const homeView = {
    deployProject: vi.fn(() => overrides.deployOutcome),
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
  test("returns a structured failure when required input is missing", async () => {
    const tool = makeTool({});

    const res = await tool.invoke(opts({}), {} as CancellationToken);

    expect(parse(res)).toEqual({
      status: "failed",
      error:
        "Missing required deployment input: directory, entrypoint, credentialName.",
    });
  });

  test("rejects a directory that escapes the workspace before touching disk", async () => {
    const { inspectProject } = await import("src/inspect");
    const tool = makeTool({
      credential: {
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
      },
    });
    const res = await tool.invoke(
      opts({
        directory: "../../etc",
        entrypoint: "app.py",
        credentialName: "prod",
      }),
      {} as CancellationToken,
    );
    expect(parse(res)).toEqual({
      status: "failed",
      error: "Project directory is outside the workspace.",
    });
    expect(inspectProject).not.toHaveBeenCalled();
  });

  test("uses the canonical project directory for inspection and writes", async () => {
    const { inspectProject } = await import("src/inspect");
    const { writeConfigToFile, createDeploymentRecord } =
      await import("src/toml");
    const tool = makeTool({
      credential: {
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
      },
      deployOutcome: {
        status: "success",
        result: {
          contentId: "abc",
          dashboardUrl: "https://c/dashboard",
          directUrl: "https://c/direct",
          logsUrl: "https://c/logs",
        },
      },
    });

    await tool.invoke(
      opts({
        directory: "./project/../project",
        entrypoint: "app.py",
        credentialName: "prod",
      }),
      {} as CancellationToken,
    );

    expect(inspectProject).toHaveBeenCalledWith({
      projectDir: expect.stringMatching(/[\\/]project$/),
      entrypoint: "app.py",
      relativeDir: "project",
    });
    expect(writeConfigToFile).toHaveBeenCalledWith(
      "app-ABCD",
      "project",
      "/root",
      expect.any(Object),
    );
    expect(createDeploymentRecord).toHaveBeenCalledWith(
      expect.objectContaining({ projectDir: "project" }),
    );
  });

  test("rejects an entrypoint that was not detected instead of choosing another", async () => {
    const { inspectProject } = await import("src/inspect");
    const { writeConfigToFile } = await import("src/toml");
    (inspectProject as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      [
        {
          projectDir: "project",
          configuration: {
            type: ContentType.PYTHON_SHINY,
            entrypoint: "other.py",
            title: "other",
            files: [],
            validate: true,
          },
        },
      ],
    );
    const tool = makeTool({
      credential: {
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
      },
    });

    const res = await tool.invoke(
      opts({
        directory: ".",
        entrypoint: "app.py",
        credentialName: "prod",
      }),
      {} as CancellationToken,
    );

    expect(parse(res)).toEqual({
      status: "failed",
      error:
        'Entrypoint "app.py" was not found in the project. Available entrypoints: other.py.',
    });
    expect(writeConfigToFile).not.toHaveBeenCalled();
  });

  test("converts thrown configuration errors into a structured failure", async () => {
    const { loadConfiguration } = await import("src/toml");
    (
      loadConfiguration as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("invalid TOML"));
    const tool = makeTool({
      credential: {
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
      },
    });

    const res = await tool.invoke(
      opts({
        directory: ".",
        entrypoint: "app.py",
        credentialName: "prod",
        configurationName: "broken-config",
      }),
      {} as CancellationToken,
    );

    expect(parse(res)).toEqual({
      status: "failed",
      error: "Deployment failed: invalid TOML",
    });
  });

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

  test("forwards the invocation's cancellation token to deployProject", async () => {
    const state = {
      findCredential: vi.fn(() => ({
        name: "prod",
        url: "https://c",
        serverType: ServerType.CONNECT,
        accountName: "",
      })),
      credentialsService: { list: vi.fn(() => []) },
    };
    const deployProject = vi.fn(() => ({
      status: "success",
      result: {},
    }));
    // @ts-expect-error minimal mocks for the unit test
    const tool = new DeployContentTool(state, { deployProject }, "9.9.9");
    const token = { isCancellationRequested: false } as CancellationToken;

    await tool.invoke(
      opts({ directory: ".", entrypoint: "app.py", credentialName: "prod" }),
      token,
    );

    expect(deployProject).toHaveBeenCalledWith(
      "deployment-WXYZ",
      "prod",
      "app-ABCD",
      ".",
      token,
    );
  });

  test("stamps a newly created config with the credential's product type", async () => {
    const { writeConfigToFile } = await import("src/toml");
    const tool = makeTool({
      credential: {
        name: "cloud",
        url: "",
        serverType: ServerType.CONNECT_CLOUD,
        accountName: "",
      },
      deployOutcome: { status: "success", result: {} },
    });
    await tool.invoke(
      opts({
        directory: ".",
        entrypoint: "app.py",
        credentialName: "cloud",
      }),
      {} as CancellationToken,
    );
    expect(writeConfigToFile).toHaveBeenCalledWith(
      "app-ABCD",
      ".",
      "/root",
      expect.objectContaining({ productType: "connect_cloud" }),
    );
  });

  test("rejects a Connect Cloud credential when the setting is disabled", async () => {
    enableConnectCloud.mockReturnValueOnce(false);
    const { writeConfigToFile } = await import("src/toml");
    const tool = makeTool({
      credential: {
        name: "cloud",
        url: "",
        serverType: ServerType.CONNECT_CLOUD,
        accountName: "",
      },
    });
    const res = await tool.invoke(
      opts({
        directory: ".",
        entrypoint: "app.py",
        credentialName: "cloud",
      }),
      {} as CancellationToken,
    );
    const data = parse(res);
    expect(data.status).toBe("failed");
    expect(data.error).toMatch(/Connect Cloud/);
    expect(writeConfigToFile).not.toHaveBeenCalled();
  });

  test("rejects an existing configuration whose product type doesn't match the credential", async () => {
    const { loadConfiguration } = await import("src/toml");
    (
      loadConfiguration as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      configuration: { productType: "connect" },
    });
    const tool = makeTool({
      credential: {
        name: "cloud",
        url: "",
        serverType: ServerType.CONNECT_CLOUD,
        accountName: "",
      },
    });
    const res = await tool.invoke(
      opts({
        directory: ".",
        entrypoint: "app.py",
        credentialName: "cloud",
        configurationName: "existing-config",
      }),
      {} as CancellationToken,
    );
    const data = parse(res);
    expect(data.status).toBe("failed");
    expect(data.error).toMatch(/targets Posit Connect/);
    expect(data.error).toMatch(/targets Posit Connect Cloud/);
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
