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
    showWarningMessage: vi.fn(),
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

const mocks = vi.hoisted(() => ({
  includeFile: vi.fn().mockResolvedValue(undefined),
  scanPythonDependencies: vi.fn().mockResolvedValue({
    python: "python3",
    incomplete: [],
  }),
  scanRPackages: vi.fn().mockResolvedValue(undefined),
  fileExists: vi.fn().mockResolvedValue(false),
  ensurePythonPackageFile: vi.fn(),
}));

vi.mock("src/configFiles", () => ({
  includeFile: mocks.includeFile,
  updateFileList: vi.fn(),
}));

vi.mock("src/interpreters/scanPythonDependencies", () => ({
  scanPythonDependencies: mocks.scanPythonDependencies,
}));

vi.mock("src/interpreters/pythonPackages", () => ({
  ensurePythonPackageFile: mocks.ensurePythonPackageFile,
  getPythonPackages: vi.fn(),
}));

vi.mock("src/interpreters/rPackages", () => ({
  scanRPackages: mocks.scanRPackages,
}));

vi.mock("src/utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/utils/files")>()),
  fileExists: mocks.fileExists,
}));

vi.mock("src/utils/progress", () => ({
  showProgress: (_title: string, _view: string, fn: () => Promise<unknown>) =>
    fn(),
}));

vi.mock("../utils/vscode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/vscode")>()),
  getPythonInterpreterPath: vi.fn().mockResolvedValue(undefined),
  getRInterpreterPath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("src/utils/positronSettings", () => ({
  getPositronRepoSettings: vi.fn(() => undefined),
}));

import { HomeViewProvider } from "./homeView";
import { configurationFactory } from "src/test/unit-test-utils/factories";
import { Configuration } from "src/api";

// Build a HomeViewProvider instance without running the constructor, with
// just the fields the scan handlers touch.
function makeProvider(config: Configuration) {
  const provider = Object.create(
    HomeViewProvider.prototype,
  ) as HomeViewProvider;
  Object.assign(provider, {
    root: { uri: { fsPath: "/root" } },
    state: { getSelectedConfiguration: vi.fn().mockResolvedValue(config) },
    refreshPythonPackages: vi.fn().mockResolvedValue(undefined),
    refreshRPackages: vi.fn().mockResolvedValue(undefined),
    sendRefreshedFilesLists: vi.fn().mockResolvedValue(undefined),
  });
  return provider;
}

describe("HomeViewProvider scan handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  test("Python scan adds the default requirements.txt to the config files", async () => {
    const config = configurationFactory.build({
      configurationName: "my-config",
      projectDir: "my project",
    });
    config.configuration.python = {
      version: "3.12",
      packageFile: "",
      packageManager: "pip",
    };
    const provider = makeProvider(config);

    await provider["onScanForPythonPackageRequirements"]();

    expect(mocks.scanPythonDependencies).toHaveBeenCalledOnce();
    expect(mocks.includeFile).toHaveBeenCalledWith(
      "my-config",
      "/requirements.txt",
      "my project",
      "/root",
    );
  });

  test("Python scan adds a custom package file to the config files", async () => {
    const config = configurationFactory.build({
      configurationName: "my-config",
      projectDir: ".",
    });
    config.configuration.python = {
      version: "3.12",
      packageFile: "reqs/prod.txt",
      packageManager: "pip",
    };
    const provider = makeProvider(config);

    await provider["onScanForPythonPackageRequirements"]();

    expect(mocks.includeFile).toHaveBeenCalledWith(
      "my-config",
      "/reqs/prod.txt",
      ".",
      "/root",
    );
  });

  test("Python scan does not touch the config if scanning fails", async () => {
    const config = configurationFactory.build();
    config.configuration.python = {
      version: "3.12",
      packageFile: "requirements.txt",
      packageManager: "pip",
    };
    mocks.scanPythonDependencies.mockRejectedValueOnce(new Error("boom"));
    const provider = makeProvider(config);

    await provider["onScanForPythonPackageRequirements"]();

    expect(mocks.includeFile).not.toHaveBeenCalled();
  });

  test("R scan adds the lockfile to the config files", async () => {
    const config = configurationFactory.build({
      configurationName: "my-config",
      projectDir: ".",
    });
    config.configuration.r = {
      version: "4.4.0",
      packageFile: "renv.lock",
      packageManager: "renv",
    };
    const provider = makeProvider(config);

    await provider["onScanForRPackageRequirements"]();

    expect(mocks.scanRPackages).toHaveBeenCalledOnce();
    expect(mocks.includeFile).toHaveBeenCalledWith(
      "my-config",
      "/renv.lock",
      ".",
      "/root",
    );
  });

  test("R scan does not touch the config if scanning fails", async () => {
    const config = configurationFactory.build();
    config.configuration.r = {
      version: "4.4.0",
      packageFile: "renv.lock",
      packageManager: "renv",
    };
    mocks.scanRPackages.mockRejectedValueOnce(new Error("boom"));
    const provider = makeProvider(config);

    await provider["onScanForRPackageRequirements"]();

    expect(mocks.includeFile).not.toHaveBeenCalled();
  });
});

describe("HomeViewProvider ensurePythonPackageFile before deploy", () => {
  beforeEach(() => vi.clearAllMocks());

  test("adds a generated requirements.txt to the config files", async () => {
    const config = configurationFactory.build({
      configurationName: "my-config",
      projectDir: "my project",
    });
    config.configuration.python = {
      version: "3.12",
      packageFile: "",
      packageManager: "pip",
    };
    mocks.ensurePythonPackageFile.mockResolvedValueOnce({
      requirements: ["numpy==2.0"],
      incomplete: [],
      python: "python3",
    });
    const provider = makeProvider(config);

    const changed = await provider["ensurePythonPackageFile"](
      config,
      "/root",
      "/root/my project",
      "/usr/bin/python3",
    );

    expect(changed).toBe(true);
    expect(mocks.ensurePythonPackageFile).toHaveBeenCalledWith(
      "/root/my project",
      "requirements.txt",
      "/usr/bin/python3",
    );
    expect(mocks.includeFile).toHaveBeenCalledWith(
      "my-config",
      "/requirements.txt",
      "my project",
      "/root",
    );
  });

  test("leaves the config alone when no file was generated", async () => {
    const config = configurationFactory.build();
    config.configuration.python = {
      version: "3.12",
      packageFile: "requirements.txt",
      packageManager: "pip",
    };
    mocks.ensurePythonPackageFile.mockResolvedValueOnce(undefined);
    const provider = makeProvider(config);

    const changed = await provider["ensurePythonPackageFile"](
      config,
      "/root",
      "/root",
    );

    expect(changed).toBe(false);
    expect(mocks.includeFile).not.toHaveBeenCalled();
  });

  test("skips non-Python configs", async () => {
    const config = configurationFactory.build();
    config.configuration.python = undefined;
    const provider = makeProvider(config);

    const changed = await provider["ensurePythonPackageFile"](
      config,
      "/root",
      "/root",
    );

    expect(changed).toBe(false);
    expect(mocks.ensurePythonPackageFile).not.toHaveBeenCalled();
  });
});
