// Copyright (C) 2026 by Posit Software, PBC.

// Shared vi.mock() declarations for all dependencies of src/extension.ts.
// Import this file in any test that does `await import("src/extension")` to
// prevent transitive import failures. Vitest registers mock factories when
// this module is evaluated, before the dynamic import resolves.

import { vi } from "vitest";

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
