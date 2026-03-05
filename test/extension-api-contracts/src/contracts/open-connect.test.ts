// Copyright (C) 2026 by Posit Software, PBC.

// Contract: open_connect.ts → window.showInputBox, workspace.updateWorkspaceFolders, commands.executeCommand

import { describe, it, expect, beforeEach, vi } from "vitest";
import { window, workspace, commands, Uri } from "vscode";

// Mock internal dependencies
vi.mock("src/logging", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("src/connect_content_fs", () => ({
  clearConnectContentBundle: vi.fn(),
  connectContentUri: vi.fn((_server: string, _guid: string) => ({
    scheme: "connect-content",
    authority: "https@connect.example.com",
    path: "/test-guid",
    fsPath: "/test-guid",
    query: "",
    fragment: "",
    toString: () => "connect-content://https@connect.example.com/test-guid",
  })),
  normalizeServerUrl: vi.fn((url: string) => {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  }),
}));

const { promptOpenConnectContent, handleConnectUri } =
  await import("src/open_connect");

describe("open-connect contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("promptOpenConnectContent", () => {
    it("calls window.showInputBox for server URL with ignoreFocusOut", async () => {
      vi.mocked(window.showInputBox).mockResolvedValueOnce(undefined);

      await promptOpenConnectContent();

      expect(window.showInputBox).toHaveBeenCalledWith({
        prompt: "Connect server URL",
        ignoreFocusOut: true,
      });
    });

    it("calls window.showInputBox for content GUID after server URL", async () => {
      vi.mocked(window.showInputBox)
        .mockResolvedValueOnce("https://connect.example.com")
        .mockResolvedValueOnce(undefined);

      await promptOpenConnectContent();

      expect(window.showInputBox).toHaveBeenCalledTimes(2);
      expect(window.showInputBox).toHaveBeenNthCalledWith(2, {
        prompt: "Connect content GUID",
        ignoreFocusOut: true,
      });
    });

    it("exits early if user cancels server URL input", async () => {
      vi.mocked(window.showInputBox).mockResolvedValueOnce(undefined);

      await promptOpenConnectContent();

      expect(window.showInputBox).toHaveBeenCalledTimes(1);
    });

    it("exits early if user cancels content GUID input", async () => {
      vi.mocked(window.showInputBox)
        .mockResolvedValueOnce("https://connect.example.com")
        .mockResolvedValueOnce(undefined);

      await promptOpenConnectContent();

      expect(workspace.updateWorkspaceFolders).not.toHaveBeenCalled();
      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe("handleConnectUri", () => {
    it("uses workspace.updateWorkspaceFolders when workspace folders exist", async () => {
      const uri = {
        path: "/connect",
        query: "server=https%3A%2F%2Fconnect.example.com&content=test-guid",
        scheme: "vscode",
        authority: "posit.publisher",
        fsPath: "/connect",
        fragment: "",
        with: vi.fn(),
        toString: () =>
          "vscode://posit.publisher/connect?server=https%3A%2F%2Fconnect.example.com&content=test-guid",
      };

      vi.mocked(workspace.updateWorkspaceFolders).mockReturnValue(true);

      await handleConnectUri(uri as any);

      expect(workspace.updateWorkspaceFolders).toHaveBeenCalledWith(
        0,
        expect.any(Number),
        { uri: expect.any(Object) },
      );
    });

    it("falls back to vscode.openFolder when no workspace folders", async () => {
      const origFolders = workspace.workspaceFolders;
      workspace.workspaceFolders = [];

      const uri = {
        path: "/connect",
        query: "server=https%3A%2F%2Fconnect.example.com&content=test-guid",
        scheme: "vscode",
        authority: "posit.publisher",
        fsPath: "/connect",
        fragment: "",
        with: vi.fn(),
        toString: () =>
          "vscode://posit.publisher/connect?server=https%3A%2F%2Fconnect.example.com&content=test-guid",
      };

      await handleConnectUri(uri as any);

      expect(commands.executeCommand).toHaveBeenCalledWith(
        "vscode.openFolder",
        expect.any(Object),
        { forceReuseWindow: true, forceNewWindow: false },
      );

      workspace.workspaceFolders = origFolders;
    });

    it("falls back to vscode.openFolder when updateWorkspaceFolders fails", async () => {
      vi.mocked(workspace.updateWorkspaceFolders).mockReturnValue(false);

      const uri = {
        path: "/connect",
        query: "server=https%3A%2F%2Fconnect.example.com&content=test-guid",
        scheme: "vscode",
        authority: "posit.publisher",
        fsPath: "/connect",
        fragment: "",
        with: vi.fn(),
        toString: () =>
          "vscode://posit.publisher/connect?server=https%3A%2F%2Fconnect.example.com&content=test-guid",
      };

      await handleConnectUri(uri as any);

      expect(commands.executeCommand).toHaveBeenCalledWith(
        "vscode.openFolder",
        expect.any(Object),
        { forceReuseWindow: true, forceNewWindow: false },
      );
    });

    it("ignores URIs that are not /connect", async () => {
      const uri = {
        path: "/something-else",
        query: "",
        scheme: "vscode",
        authority: "posit.publisher",
        fsPath: "/something-else",
        fragment: "",
        with: vi.fn(),
        toString: () => "vscode://posit.publisher/something-else",
      };

      await handleConnectUri(uri as any);

      expect(workspace.updateWorkspaceFolders).not.toHaveBeenCalled();
      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
