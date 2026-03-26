// Copyright (C) 2026 by Posit Software, PBC.

// Contract: entrypointTracker.ts → editor tracking events, commands.executeCommand("setContext")

import { describe, it, expect, beforeEach, vi } from "vitest";
import { window, workspace, commands, Disposable } from "vscode";

// Mock internal dependencies
vi.mock("src/api", () => ({
  useApi: vi.fn(() =>
    Promise.resolve({
      configurations: {
        inspect: vi.fn(() =>
          Promise.resolve({ data: [{ configuration: { type: "unknown" } }] }),
        ),
      },
    }),
  ),
}));

vi.mock("src/utils/vscode", () => ({
  getPythonInterpreterPath: vi.fn(() => Promise.resolve(undefined)),
  getRInterpreterPath: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("src/utils/files", () => ({
  isActiveDocument: vi.fn(() => false),
  relativeDir: vi.fn(() => "."),
}));

vi.mock("src/utils/inspect", () => ({
  hasKnownContentType: vi.fn(() => false),
}));

vi.mock("src/utils/errors", () => ({
  getSummaryStringFromError: vi.fn(() => "error summary"),
  isConnectionRefusedError: vi.fn(() => false),
}));

vi.mock("vscode-uri", () => ({
  Utils: { basename: vi.fn((uri: any) => "file.py") },
}));

vi.mock("src/utils/getUri", () => ({
  getFileUriFromTab: vi.fn(() => undefined),
}));

const { DocumentTracker } = await import("src/entrypointTracker");

describe("document-tracker contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.activeTextEditor = undefined;
    window.activeNotebookEditor = undefined;
  });

  describe("event subscriptions", () => {
    it("subscribes to window.onDidChangeActiveTextEditor", () => {
      new DocumentTracker();
      expect(window.onDidChangeActiveTextEditor).toHaveBeenCalledTimes(1);
      expect(window.onDidChangeActiveTextEditor).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("subscribes to window.onDidChangeActiveNotebookEditor", () => {
      new DocumentTracker();
      expect(window.onDidChangeActiveNotebookEditor).toHaveBeenCalledTimes(1);
      expect(window.onDidChangeActiveNotebookEditor).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("subscribes to workspace.onDidCloseTextDocument", () => {
      new DocumentTracker();
      expect(workspace.onDidCloseTextDocument).toHaveBeenCalledTimes(1);
      expect(workspace.onDidCloseTextDocument).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("subscribes to workspace.onDidSaveTextDocument", () => {
      new DocumentTracker();
      expect(workspace.onDidSaveTextDocument).toHaveBeenCalledTimes(1);
      expect(workspace.onDidSaveTextDocument).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("subscribes to workspace.onDidCloseNotebookDocument", () => {
      new DocumentTracker();
      expect(workspace.onDidCloseNotebookDocument).toHaveBeenCalledTimes(1);
      expect(workspace.onDidCloseNotebookDocument).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("subscribes to workspace.onDidSaveNotebookDocument", () => {
      new DocumentTracker();
      expect(workspace.onDidSaveNotebookDocument).toHaveBeenCalledTimes(1);
      expect(workspace.onDidSaveNotebookDocument).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("subscribes to window.tabGroups.onDidChangeTabGroups", () => {
      new DocumentTracker();
      expect(window.tabGroups.onDidChangeTabGroups).toHaveBeenCalledTimes(1);
      expect(window.tabGroups.onDidChangeTabGroups).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });
  });

  describe("setContext calls", () => {
    it("uses commands.executeCommand('setContext', 'posit.publish.activeFileEntrypoint', value)", async () => {
      const tracker = new DocumentTracker();

      // Simulate an editor change with a text editor
      const mockDoc = {
        uri: { fsPath: "/workspace/test.py", path: "/workspace/test.py" },
      };
      const mockEditor = { document: mockDoc };

      await tracker.onActiveEditorChanged(mockEditor as any);

      expect(commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "posit.publish.activeFileEntrypoint",
        expect.any(Boolean),
      );
    });
  });
});
