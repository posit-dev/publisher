// Copyright (C) 2026 by Posit Software, PBC.

// Contract: extension.ts extensionSettings → workspace.getConfiguration("positPublisher")

import { describe, it, expect, beforeEach, vi } from "vitest";
import { workspace } from "vscode";

// Mock ALL dependencies of extension.ts to prevent transitive import failures
vi.mock("src/ports", () => ({
  acquire: vi.fn(() => Promise.resolve(9999)),
}));

vi.mock("src/services", () => ({
  Service: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(() => Promise.resolve()),
    showOutputChannel: vi.fn(),
  })),
}));

vi.mock("src/views/project", () => ({
  ProjectTreeDataProvider: vi.fn(() => ({ register: vi.fn() })),
}));

vi.mock("src/views/logs", () => ({
  LogsTreeDataProvider: vi.fn(() => ({ register: vi.fn() })),
  LogsViewProvider: Object.assign(
    vi.fn(() => ({ register: vi.fn() })),
    { openRawLogFileView: vi.fn(), copyLogs: vi.fn() },
  ),
}));

vi.mock("src/events", () => ({
  EventStream: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("src/views/homeView", () => ({
  HomeViewProvider: vi.fn(() => ({
    register: vi.fn(),
    showNewDeploymentMultiStep: vi.fn(() => Promise.resolve()),
    handleFileInitiatedDeploymentSelection: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("src/watchers", () => ({
  WatcherManager: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("src/entrypointTracker", () => ({
  DocumentTracker: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("src/utils/config", () => ({
  getXDGConfigProperty: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("src/state", () => ({
  PublisherState: vi.fn(() => ({
    credentials: [],
    refreshCredentials: vi.fn(() => Promise.resolve()),
    onDidRefreshCredentials: vi.fn(() => ({ dispose: vi.fn() })),
  })),
}));

vi.mock("src/authProvider", () => ({
  PublisherAuthProvider: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("src/logging", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("src/commands", () => ({
  copySystemInfoCommand: vi.fn(() => Promise.resolve()),
}));

vi.mock("src/llm", () => ({
  registerLLMTooling: vi.fn(),
}));

vi.mock("src/connect_content_fs", () => ({
  clearConnectContentBundleForUri: vi.fn(),
  registerConnectContentFileSystem: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("src/open_connect", () => ({
  handleConnectUri: vi.fn(),
  promptOpenConnectContent: vi.fn(() => Promise.resolve()),
}));

const { extensionSettings } = await import("src/extension");

describe("extension-settings contract", () => {
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(undefined);
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as any);
  });

  it("reads verifyCertificates from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.verifyCertificates();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("verifyCertificates");
    expect(result).toBe(true);
  });

  it("returns configured verifyCertificates value when set", () => {
    mockGet.mockReturnValue(false);
    const result = extensionSettings.verifyCertificates();
    expect(result).toBe(false);
  });

  it("reads useKeyChainCredentialStorage from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.useKeyChainCredentialStorage();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("useKeyChainCredentialStorage");
    expect(result).toBe(true);
  });

  it("reads defaultConnectServer from positPublisher config (default '')", async () => {
    mockGet.mockReturnValue(undefined);
    const result = await extensionSettings.defaultConnectServer();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("defaultConnectServer");
    expect(result).toBe("");
  });

  it("returns configured defaultConnectServer when set", async () => {
    mockGet.mockReturnValue("https://connect.example.com");
    const result = await extensionSettings.defaultConnectServer();
    expect(result).toBe("https://connect.example.com");
  });

  it("reads autoOpenLogsOnFailure from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.autoOpenLogsOnFailure();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("autoOpenLogsOnFailure");
    expect(result).toBe(true);
  });

  it("reads enableConnectCloud from positPublisher config (default true)", () => {
    mockGet.mockReturnValue(undefined);
    const result = extensionSettings.enableConnectCloud();
    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(mockGet).toHaveBeenCalledWith("enableConnectCloud");
    expect(result).toBe(true);
  });
});
