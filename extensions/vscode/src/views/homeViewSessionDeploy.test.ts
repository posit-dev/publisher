// Copyright (C) 2026 by Posit Software, PBC.

import { ConnectAPI, ContentID } from "@posit-dev/connect-api";
import { AxiosHeaders } from "axios";
import os from "node:os";
import path from "node:path";
import {
  configurationFactory,
  contentRecordFactory,
  credentialFactory,
} from "src/test/unit-test-utils/factories";
import type { DeployProgressOptions } from "src/views/deployProgress";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockWindow, mockConnectPublish, mockRunDeployWithProgress, mockRoot } =
  vi.hoisted(() => ({
    mockWindow: {
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      setStatusBarMessage: vi.fn(),
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        show: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    },
    mockConnectPublish: vi.fn(),
    mockRunDeployWithProgress: vi.fn(),
    mockRoot: { value: "" },
  }));

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
  window: mockWindow,
  workspace: {
    get workspaceFolders() {
      return [{ uri: { fsPath: mockRoot.value }, name: "root", index: 0 }];
    },
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

vi.mock("src/credentials/service", () => ({
  connectAPIOptionsFromCredential: vi.fn(() =>
    Promise.resolve({
      url: "https://connect.example.com",
      apiKey: "session-key",
      userAgent: "test",
    }),
  ),
}));

vi.mock("src/utils/vscode", () => ({
  getPythonInterpreterPath: vi.fn(() => Promise.resolve(undefined)),
  getRInterpreterPath: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("src/utils/positronSettings", () => ({
  getPositronRepoSettings: vi.fn(() => ({ r: undefined })),
}));

vi.mock("src/views/deployProgress", () => ({
  runDeployWithProgress: mockRunDeployWithProgress,
}));

vi.mock("src/publish/connectPublish", () => ({
  connectPublish: mockConnectPublish,
}));

import { HomeViewProvider } from "./homeView";
import { window } from "vscode";

const sourceDetails = {
  guid: "source-guid",
  name: "source-name",
  title: "Source app",
  description: "",
  access_type: "acl",
  connection_timeout: null,
  read_timeout: null,
  init_timeout: null,
  idle_timeout: null,
  max_processes: null,
  min_processes: null,
  max_conns_per_process: null,
  load_factor: null,
  created_time: "",
  last_deployed_time: "",
  bundle_id: "bundle-2",
  app_mode: "python-shiny",
  content_category: "",
  parameterized: false,
  cluster_name: null,
  image_name: null,
  r_version: null,
  py_version: null,
  quarto_version: null,
  run_as: null,
  run_as_current_user: false,
  owner_guid: "owner-guid",
  content_url: "",
  dashboard_url: "",
  locked: false,
  app_role: "editor",
  id: "1",
};

function makeProvider(contentId: string) {
  const record = contentRecordFactory.build({
    id: ContentID(contentId),
    serverUrl: "https://connect.example.com",
    projectDir: ".",
    deploymentName: "deployment",
    configurationName: "configuration",
    deploymentPath: path.join(
      mockRoot.value,
      ".posit",
      "publish",
      "deployments",
      "deployment.toml",
    ),
  });
  const credential = credentialFactory.build({
    name: "credential",
    url: "https://connect.example.com",
  });
  const state = {
    refreshContentRecords: vi.fn(async () => {}),
    refreshConfigurations: vi.fn(async () => {}),
    findContentRecord: vi.fn(() => record),
    findCredential: vi.fn((name: string) =>
      name === credential.name ? credential : undefined,
    ),
    credentialsService: {},
  };
  // Use the existing prototype harness to exercise the real deploy method without editor services.
  const provider = Object.create(
    HomeViewProvider.prototype,
  ) as HomeViewProvider;
  Object.assign(provider, {
    root: { uri: { fsPath: mockRoot.value } },
    context: { extension: { packageJSON: { version: "test" } } },
    state,
    stream: { injectMessage: vi.fn() },
    webviewConduit: { sendMsg: vi.fn() },
    propagateDeploymentSelection: vi.fn(),
    loadFreshConfig: vi.fn(() =>
      Promise.resolve(
        configurationFactory.build({
          configurationName: "configuration",
          projectDir: ".",
        }),
      ),
    ),
    ensurePythonPackageFile: vi.fn(() => Promise.resolve(false)),
  });
  return { provider, state };
}

describe("HomeViewProvider.deployProject linked-source confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoot.value = path.join(os.tmpdir(), "publisher session deployment");
    vi.stubEnv("POSIT_PRODUCT", "CONNECT");
    vi.stubEnv("CONNECT_SERVER", "https://connect.example.com");
    vi.stubEnv("CONNECT_DEPLOY_TARGET_GUID", "source-guid");
    vi.stubEnv("CONNECT_DEPLOY_TARGET_BUNDLE_ID", "bundle-2");
    vi.spyOn(ConnectAPI.prototype, "contentDetails").mockResolvedValue({
      data: sourceDetails,
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockConnectPublish.mockResolvedValue({
      contentId: "source-guid",
      dashboardUrl: "https://connect.example.com/connect/#/apps/source-guid",
      directUrl: "https://connect.example.com/content/source-guid",
      logsUrl: "https://connect.example.com/connect/#/apps/source-guid/logs",
      bundleId: "bundle-3",
    });
    mockRunDeployWithProgress.mockImplementation(
      async (options: DeployProgressOptions) => ({
        status: "success",
        result: await options.deploy(() => {}, new AbortController().signal),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("deploys to the linked source without a confirmation prompt", async () => {
    const { provider } = makeProvider("source-guid");

    const outcome = await provider.deployProject(
      "deployment",
      "credential",
      "configuration",
      ".",
    );

    expect(ConnectAPI.prototype.contentDetails).toHaveBeenCalledWith(
      "source-guid",
    );
    expect(window.showWarningMessage).not.toHaveBeenCalled();
    expect(mockRunDeployWithProgress).toHaveBeenCalledOnce();
    expect(mockConnectPublish).toHaveBeenCalledOnce();
    expect(mockConnectPublish.mock.calls[0]?.[0].config.title).toBeUndefined();
    expect(outcome.status).toBe("success");
  });

  test("checks the linked target when the server identity is unavailable", async () => {
    vi.stubEnv("CONNECT_SERVER", undefined);
    const { provider } = makeProvider("source-guid");

    const outcome = await provider.deployProject(
      "deployment",
      "credential",
      "configuration",
      ".",
    );

    expect(ConnectAPI.prototype.contentDetails).toHaveBeenCalledWith(
      "source-guid",
    );
    expect(mockConnectPublish).toHaveBeenCalledOnce();
    expect(outcome.status).toBe("success");
  });

  test("a failed source lookup prevents publishing", async () => {
    vi.mocked(ConnectAPI.prototype.contentDetails).mockRejectedValueOnce(
      new Error("Forbidden"),
    );
    const { provider } = makeProvider("source-guid");

    const outcome = await provider.deployProject(
      "deployment",
      "credential",
      "configuration",
      ".",
    );

    expect(ConnectAPI.prototype.contentDetails).toHaveBeenCalledWith(
      "source-guid",
    );
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("editor access"),
    );
    expect(window.showWarningMessage).not.toHaveBeenCalled();
    expect(mockConnectPublish).not.toHaveBeenCalled();
    expect(mockRunDeployWithProgress).not.toHaveBeenCalled();
    expect(outcome.status).toBe("failed");
  });

  test("a stale-source warning does not delay publishing", async () => {
    vi.stubEnv("CONNECT_DEPLOY_TARGET_BUNDLE_ID", "bundle-1");
    vi.mocked(window.showWarningMessage).mockImplementation(
      () => new Promise(() => {}),
    );
    const { provider } = makeProvider("source-guid");

    const outcome = await provider.deployProject(
      "deployment",
      "credential",
      "configuration",
      ".",
    );

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("source has changed"),
    );
    expect(mockConnectPublish).toHaveBeenCalledOnce();
    expect(mockConnectPublish.mock.calls[0]?.[0]).toMatchObject({
      existingContentId: "source-guid",
      serverUrl: "https://connect.example.com",
    });
    expect(outcome.status).toBe("success");
  });

  test("an existing non-target deployment skips the source prompt", async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue(undefined);
    const { provider } = makeProvider("existing-guid");

    const outcome = await provider.deployProject(
      "deployment",
      "credential",
      "configuration",
      ".",
    );

    expect(ConnectAPI.prototype.contentDetails).not.toHaveBeenCalled();
    expect(window.showWarningMessage).not.toHaveBeenCalled();
    expect(mockConnectPublish).toHaveBeenCalledOnce();
    expect(mockConnectPublish.mock.calls[0]?.[0]).toMatchObject({
      existingContentId: "existing-guid",
    });
    expect(outcome.status).toBe("success");
  });
});
