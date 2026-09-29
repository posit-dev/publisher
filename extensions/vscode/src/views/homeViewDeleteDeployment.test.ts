// Copyright (C) 2026 by Posit Software, PBC.

import fs from "fs";
import os from "os";
import path from "path";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockWindow, mockWorkspaceRoot } = vi.hoisted(() => ({
  mockWindow: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    setStatusBarMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), show: vi.fn() })),
  },
  mockWorkspaceRoot: { value: "" },
}));

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
  window: mockWindow,
  workspace: {
    get workspaceFolders() {
      return [
        { uri: { fsPath: mockWorkspaceRoot.value }, name: "root", index: 0 },
      ];
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

vi.mock("src/dialogs", () => ({
  confirmDelete: vi.fn(() => Promise.resolve(true)),
  confirmOverwrite: vi.fn(() => Promise.resolve(true)),
}));

import { HomeViewProvider } from "./homeView";
import { confirmDelete } from "src/dialogs";
import {
  contentRecordFactory,
  credentialFactory,
  preContentRecordFactory,
} from "src/test/unit-test-utils/factories";
import type {
  ContentRecord,
  PreContentRecord,
} from "src/api/types/contentRecords";
import type { Credential } from "src/api/types/credentials";

let root: string;

function writeFile(rel: string): string {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, "");
  return abs;
}

function makeRecord(overrides: Partial<ContentRecord> = {}): ContentRecord {
  const configurationName = overrides.configurationName ?? "my config";
  const deploymentName = overrides.deploymentName ?? "my app";
  return contentRecordFactory.build({
    projectDir: ".",
    configurationName,
    deploymentName,
    deploymentPath: writeFile(
      path.join(".posit", "publish", "deployments", `${deploymentName}.toml`),
    ),
    ...overrides,
  });
}

// Build a HomeViewProvider instance without running the constructor: we only
// exercise deleteDeployment, which depends on `state` and a few (private)
// collaborator methods.
function makeProvider(
  record: ContentRecord | PreContentRecord,
  others: (ContentRecord | PreContentRecord)[] = [],
) {
  const provider = Object.create(
    HomeViewProvider.prototype,
  ) as HomeViewProvider;
  const state = {
    getSelectedContentRecord: vi.fn(() => Promise.resolve(record)),
    findCredentialForContentRecord: vi.fn((): Credential | undefined =>
      credentialFactory.build(),
    ),
    contentRecords: [record, ...others],
    refreshContentRecords: vi.fn(async () => {}),
    refreshConfigurations: vi.fn(async () => {}),
  };
  const deleteContentOnServer = vi.fn(async () => {});
  Object.assign(provider, {
    state,
    deleteContentOnServer,
    saveSelectionState: vi.fn(async () => {}),
    updateWebViewViewConfigurations: vi.fn(),
    updateWebViewViewContentRecords: vi.fn(),
  });
  return { provider, state, deleteContentOnServer };
}

function httpError(status: number): AxiosError {
  return new AxiosError("request failed", "ERR", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });
}

describe("HomeViewProvider.deleteDeployment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(confirmDelete).mockResolvedValue(true);
    root = fs.mkdtempSync(path.join(os.tmpdir(), "delete deployment "));
    mockWorkspaceRoot.value = root;
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("deletes server content, the record, and an unshared config", async () => {
    const record = makeRecord();
    const configPath = writeFile(
      path.join(".posit", "publish", "my config.toml"),
    );
    const { provider, deleteContentOnServer } = makeProvider(record);

    await provider.deleteDeployment();

    expect(deleteContentOnServer).toHaveBeenCalledOnce();
    expect(fs.existsSync(record.deploymentPath)).toBe(false);
    expect(fs.existsSync(configPath)).toBe(false);
    expect(vi.mocked(confirmDelete).mock.calls[0]?.[1]).toBe(
      "This permanently deletes the content on the server, its deployment record, and its configuration file.",
    );
  });

  test("keeps a config file that another deployment uses", async () => {
    const record = makeRecord();
    const other = makeRecord({ deploymentName: "other app" });
    const configPath = writeFile(
      path.join(".posit", "publish", "my config.toml"),
    );
    const { provider } = makeProvider(record, [other]);

    await provider.deleteDeployment();

    expect(fs.existsSync(record.deploymentPath)).toBe(false);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(vi.mocked(confirmDelete).mock.calls[0]?.[1]).toContain(
      "Its configuration file is kept because another deployment uses it.",
    );
  });

  test("never deletes a config file outside the config directory", async () => {
    const outside = writeFile("victim.toml");
    const record = makeRecord({ configurationName: "../../victim" });
    const { provider } = makeProvider(record);

    await provider.deleteDeployment();

    expect(fs.existsSync(record.deploymentPath)).toBe(false);
    expect(fs.existsSync(outside)).toBe(true);
    expect(vi.mocked(confirmDelete).mock.calls[0]?.[1]).not.toContain(
      "configuration file",
    );
  });

  test("skips the server for a record that was never deployed", async () => {
    const record = preContentRecordFactory.build({
      projectDir: ".",
      configurationName: "my config",
      deploymentPath: writeFile(
        path.join(".posit", "publish", "deployments", "pre.toml"),
      ),
    });
    const { provider, state, deleteContentOnServer } = makeProvider(record);

    await provider.deleteDeployment();

    expect(state.findCredentialForContentRecord).not.toHaveBeenCalled();
    expect(deleteContentOnServer).not.toHaveBeenCalled();
    expect(fs.existsSync(record.deploymentPath)).toBe(false);
  });

  test("still removes the local record when the server content is already gone", async () => {
    const record = makeRecord();
    const { provider, deleteContentOnServer } = makeProvider(record);
    deleteContentOnServer.mockRejectedValue(httpError(404));

    await provider.deleteDeployment();

    expect(fs.existsSync(record.deploymentPath)).toBe(false);
    expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
  });

  test("keeps local files when the server delete fails", async () => {
    const record = makeRecord();
    const configPath = writeFile(
      path.join(".posit", "publish", "my config.toml"),
    );
    const { provider, deleteContentOnServer } = makeProvider(record);
    deleteContentOnServer.mockRejectedValue(httpError(500));

    await provider.deleteDeployment();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledOnce();
    expect(fs.existsSync(record.deploymentPath)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);
  });

  test("stops before confirming when no credential matches the server", async () => {
    const record = makeRecord();
    const { provider, state, deleteContentOnServer } = makeProvider(record);
    state.findCredentialForContentRecord.mockReturnValue(undefined);

    await provider.deleteDeployment();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledOnce();
    expect(confirmDelete).not.toHaveBeenCalled();
    expect(deleteContentOnServer).not.toHaveBeenCalled();
    expect(fs.existsSync(record.deploymentPath)).toBe(true);
  });

  test("does nothing when the user cancels", async () => {
    const record = makeRecord();
    const { provider, deleteContentOnServer } = makeProvider(record);
    vi.mocked(confirmDelete).mockResolvedValue(false);

    await provider.deleteDeployment();

    expect(deleteContentOnServer).not.toHaveBeenCalled();
    expect(fs.existsSync(record.deploymentPath)).toBe(true);
  });
});
