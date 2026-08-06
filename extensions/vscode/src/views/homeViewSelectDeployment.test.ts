// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";

// Minimal vscode surface needed to import homeView.ts and its graph.
vi.mock("vscode", () => ({
  Disposable: class {
    dispose() {}
  },
  ThemeIcon: class {
    constructor(public id: string) {}
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
    joinPath: () => ({}),
    parse: (s: string) => ({ toString: () => s }),
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
  commands: { executeCommand: vi.fn(), registerCommand: vi.fn() },
  env: { appName: "VSCode" },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), show: vi.fn() })),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/root" }, name: "root", index: 0 }],
    getConfiguration: vi.fn(() => ({ get: vi.fn() })),
  },
  QuickPickItemKind: { Separator: -1 },
  ProgressLocation: { Notification: 15 },
  l10n: { t: (s: string) => s },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  MarkdownString: class {
    constructor(public value?: string) {}
  },
  RelativePattern: class {
    constructor(
      public base: unknown,
      public pattern: string,
    ) {}
  },
}));

// Avoid running extension.ts activation side effects on import.
vi.mock("src/extension", () => ({
  extensionSettings: { verifyCertificates: () => true },
  setSelectionHasCredentialMatch: vi.fn(),
  setSelectionIsPreContentRecord: vi.fn(),
  SelectionCredentialMatch: { Yes: "yes", No: "no" },
  SelectionIsPreContentRecord: { Yes: "yes", No: "no" },
}));

vi.mock("src/utils/webviewConduit", () => ({
  WebviewConduit: class {
    sendMsg = vi.fn();
    init = vi.fn();
    onMsg = vi.fn();
  },
}));

import { HomeViewProvider } from "./homeView";
import { preContentRecordFactory } from "src/test/unit-test-utils/factories";

// Build a HomeViewProvider instance without running the constructor: we only
// exercise deployProject/selectDeployment, which depend on `state` and a couple
// of (private) collaborator methods.
function makeProvider(overrides: {
  refreshContentRecords?: () => Promise<void>;
  refreshConfigurations?: () => Promise<void>;
  findContentRecord?: (name: string, dir: string) => unknown;
}) {
  const provider = Object.create(
    HomeViewProvider.prototype,
  ) as HomeViewProvider;

  const state = {
    refreshContentRecords:
      overrides.refreshContentRecords ?? vi.fn(async () => {}),
    refreshConfigurations:
      overrides.refreshConfigurations ?? vi.fn(async () => {}),
    findContentRecord: overrides.findContentRecord ?? vi.fn(() => undefined),
  };
  // Inject the private `state` field.
  Object.assign(provider, { state });

  // Stub the private collaborators so we assert wiring, not their internals.
  const propagate = vi.fn();
  const initiateDeployment = vi.fn();
  Object.assign(provider, {
    propagateDeploymentSelection: propagate,
    initiateDeployment,
  });

  return { provider, state, propagate, initiateDeployment };
}

describe("HomeViewProvider.selectDeployment", () => {
  beforeEach(() => vi.clearAllMocks());

  test("refreshes caches, then propagates the found record's selector", async () => {
    const record = preContentRecordFactory.build({
      deploymentName: "dep-1",
      deploymentPath: "/root/.posit/publish/deployments/dep-1.toml",
      projectDir: "sub",
    });
    const refreshContentRecords = vi.fn(async () => {});
    const refreshConfigurations = vi.fn(async () => {});
    const findContentRecord = vi.fn(() => record);
    const { provider, propagate } = makeProvider({
      refreshContentRecords,
      refreshConfigurations,
      findContentRecord,
    });

    await provider.selectDeployment("dep-1", "sub");

    expect(refreshContentRecords).toHaveBeenCalledOnce();
    expect(refreshConfigurations).toHaveBeenCalledOnce();
    expect(findContentRecord).toHaveBeenCalledWith("dep-1", "sub");
    expect(propagate).toHaveBeenCalledWith({
      deploymentName: "dep-1",
      deploymentPath: "/root/.posit/publish/deployments/dep-1.toml",
      projectDir: "sub",
    });
  });

  test("no-op propagate when the record is not found", async () => {
    const { provider, propagate } = makeProvider({
      findContentRecord: vi.fn(() => undefined),
    });

    await provider.selectDeployment("missing", ".");

    expect(propagate).not.toHaveBeenCalled();
  });
});

describe("HomeViewProvider.deployProject", () => {
  beforeEach(() => vi.clearAllMocks());

  test("selects the deployment before starting the deploy", async () => {
    const { provider, initiateDeployment } = makeProvider({});
    initiateDeployment.mockResolvedValue({
      status: "success",
      result: {
        contentId: "c",
        dashboardUrl: "d",
        directUrl: "u",
        logsUrl: "l",
      },
    });
    const selectSpy = vi
      .spyOn(provider, "selectDeployment")
      .mockResolvedValue(undefined);

    const outcome = await provider.deployProject("dep-1", "cred", "cfg", "sub");

    expect(selectSpy).toHaveBeenCalledWith("dep-1", "sub");
    expect(initiateDeployment).toHaveBeenCalledWith(
      "dep-1",
      "cred",
      "cfg",
      "sub",
      undefined,
      false,
      undefined,
    );
    // Selection happens before the deploy starts.
    expect(selectSpy.mock.invocationCallOrder[0]).toBeLessThan(
      initiateDeployment.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(outcome.status).toBe("success");
  });

  test("still selects the deployment even when the deploy fails", async () => {
    const { provider, initiateDeployment } = makeProvider({});
    initiateDeployment.mockResolvedValue({
      status: "failed",
      message: "boom",
    });
    const selectSpy = vi
      .spyOn(provider, "selectDeployment")
      .mockResolvedValue(undefined);

    const outcome = await provider.deployProject("dep-1", "cred", "cfg", "sub");

    expect(selectSpy).toHaveBeenCalledWith("dep-1", "sub");
    expect(outcome.status).toBe("failed");
  });
});
