// Copyright (C) 2026 by Posit Software, PBC.

// Contract: watchers.ts → workspace.createFileSystemWatcher, RelativePattern

import { describe, it, expect, beforeEach, vi } from "vitest";
import { workspace, RelativePattern, Uri } from "vscode";

// Mock internal dependencies
vi.mock("src/utils/files", () => ({
  relativePath: vi.fn((uri: any) => uri?.fsPath ?? uri?.path),
}));

const { WatcherManager, ConfigWatcherManager } = await import("src/watchers");

describe("file-watchers contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("WatcherManager", () => {
    it("uses RelativePattern with workspace.workspaceFolders[0] as the watcher root", () => {
      new WatcherManager();
      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      for (const call of calls) {
        const pattern = call[0];
        expect(pattern).toBeInstanceOf(RelativePattern);
        expect((pattern as RelativePattern).base).toBe(
          workspace.workspaceFolders![0],
        );
      }
    });

    it("does nothing when no workspace folders", () => {
      const origFolders = workspace.workspaceFolders;
      workspace.workspaceFolders = [];
      new WatcherManager();
      expect(workspace.createFileSystemWatcher).not.toHaveBeenCalled();
      workspace.workspaceFolders = origFolders;
    });
  });

  describe("ConfigWatcherManager", () => {
    it("uses Uri.joinPath to scope package file watchers to the project directory", () => {
      const cfg = {
        configurationPath: ".posit/publish/my-config.toml",
        projectDir: "my-project",
        configuration: {
          python: { packageFile: "requirements.txt" },
          r: { packageFile: "renv.lock" },
        },
      };

      new ConfigWatcherManager(cfg as any);

      expect(Uri.joinPath).toHaveBeenCalledWith(
        workspace.workspaceFolders![0].uri,
        "my-project",
      );
    });
  });
});
