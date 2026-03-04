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
    it("uses workspace.workspaceFolders[0] as the watcher root", () => {
      new WatcherManager();
      // All createFileSystemWatcher calls should use the first workspace folder
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

    it("creates 6 file system watchers", () => {
      new WatcherManager();
      expect(workspace.createFileSystemWatcher).toHaveBeenCalledTimes(6);
    });

    it("creates watcher for .posit directory (delete only)", () => {
      new WatcherManager();
      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
      const positDirCall = calls.find(
        (c) => (c[0] as RelativePattern).pattern === "**/.posit",
      );
      expect(positDirCall).toBeDefined();
      // ignoreCreate=true, ignoreChange=true, ignoreDelete=false
      expect(positDirCall![1]).toBe(true);
      expect(positDirCall![2]).toBe(true);
      expect(positDirCall![3]).toBe(false);
    });

    it("creates watcher for .posit/publish directory (delete only)", () => {
      new WatcherManager();
      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
      const publishDirCall = calls.find(
        (c) => (c[0] as RelativePattern).pattern === "**/.posit/publish",
      );
      expect(publishDirCall).toBeDefined();
      expect(publishDirCall![1]).toBe(true);
      expect(publishDirCall![2]).toBe(true);
      expect(publishDirCall![3]).toBe(false);
    });

    it("creates watcher for configurations pattern", () => {
      new WatcherManager();
      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
      const configCall = calls.find(
        (c) =>
          (c[0] as RelativePattern).pattern === "**/.posit/publish/*.toml",
      );
      expect(configCall).toBeDefined();
      // No ignoreCreate/ignoreChange/ignoreDelete args (watches all events)
      expect(configCall!.length).toBe(1);
    });

    it("creates watcher for deployments directory (delete only)", () => {
      new WatcherManager();
      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
      const deploymentsDir = calls.find(
        (c) =>
          (c[0] as RelativePattern).pattern ===
          "**/.posit/publish/deployments",
      );
      expect(deploymentsDir).toBeDefined();
      expect(deploymentsDir![1]).toBe(true);
      expect(deploymentsDir![2]).toBe(true);
      expect(deploymentsDir![3]).toBe(false);
    });

    it("creates watcher for deployment records", () => {
      new WatcherManager();
      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
      const deploymentsCall = calls.find(
        (c) =>
          (c[0] as RelativePattern).pattern ===
          "**/.posit/publish/deployments/*.toml",
      );
      expect(deploymentsCall).toBeDefined();
    });

    it("creates all-files watcher", () => {
      new WatcherManager();
      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
      const allFiles = calls.find(
        (c) => (c[0] as RelativePattern).pattern === "**",
      );
      expect(allFiles).toBeDefined();
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
    it("creates watchers using Uri.joinPath for package file patterns", () => {
      const cfg = {
        configurationPath: ".posit/publish/my-config.toml",
        projectDir: "my-project",
        configuration: {
          python: { packageFile: "requirements.txt" },
          r: { packageFile: "renv.lock" },
        },
      };

      new ConfigWatcherManager(cfg as any);

      // Should create 3 watchers: config file, python packages, r packages
      expect(workspace.createFileSystemWatcher).toHaveBeenCalledTimes(3);

      // Check that Uri.joinPath is used for python and r package file watchers
      expect(Uri.joinPath).toHaveBeenCalledWith(
        workspace.workspaceFolders![0].uri,
        "my-project",
      );
    });

    it("uses default package filenames when not specified", () => {
      const cfg = {
        configurationPath: ".posit/publish/config.toml",
        projectDir: ".",
        configuration: {},
      };

      new ConfigWatcherManager(cfg as any);

      const calls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;

      // Python package watcher should use default "requirements.txt"
      const pythonCall = calls[1];
      expect((pythonCall[0] as RelativePattern).pattern).toBe(
        "requirements.txt",
      );

      // R package watcher should use default "renv.lock"
      const rCall = calls[2];
      expect((rCall[0] as RelativePattern).pattern).toBe("renv.lock");
    });
  });
});
