// Copyright (C) 2026 by Posit Software, PBC.

// Contract: utils/vscode.ts → Positron + VSCode runtime APIs for interpreter discovery

import { describe, it, expect, beforeEach, vi } from "vitest";
import { commands, workspace, Uri } from "vscode";
import {
  acquirePositronApi,
  mockPositronRuntime,
} from "../../src/mocks/positron";

// Mock internal dependencies
vi.mock("src/utils/files", () => ({
  fileExists: vi.fn(() => Promise.resolve(false)),
  isDir: vi.fn(() => Promise.resolve(false)),
}));

vi.mock("src/utils/variables", () => ({
  substituteVariables: vi.fn((s: string) => s),
}));

vi.mock("src/utils/throttle", () => ({
  delay: vi.fn(() => Promise.resolve()),
}));

// Make acquirePositronApi available globally (as it is in the real extension)
(globalThis as any).acquirePositronApi = acquirePositronApi;

const { fileExists, isDir } = await import("src/utils/files");
const {
  getPythonInterpreterPath,
  getRInterpreterPath,
  getPreferredRuntimeFromPositron,
} = await import("src/utils/vscode");

describe("interpreter-discovery contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the Positron API cache by re-setting the global
    (globalThis as any).acquirePositronApi = acquirePositronApi;
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(isDir).mockResolvedValue(false);
  });

  describe("Positron runtime API", () => {
    it("calls positron.runtime.getPreferredRuntime('python')", async () => {
      mockPositronRuntime.getPreferredRuntime.mockResolvedValue({
        runtimePath: "/usr/bin/python3",
      });
      const result = await getPreferredRuntimeFromPositron("python");
      expect(mockPositronRuntime.getPreferredRuntime).toHaveBeenCalledWith(
        "python",
      );
      expect(result).toBe("/usr/bin/python3");
    });

    it("calls positron.runtime.getPreferredRuntime('r')", async () => {
      mockPositronRuntime.getPreferredRuntime.mockResolvedValue({
        runtimePath: "/usr/bin/R",
      });
      const result = await getPreferredRuntimeFromPositron("r");
      expect(mockPositronRuntime.getPreferredRuntime).toHaveBeenCalledWith("r");
      expect(result).toBe("/usr/bin/R");
    });

    it("returns undefined when Positron API is not available", async () => {
      (globalThis as any).acquirePositronApi = () => {
        throw new Error("not in Positron");
      };
      // Need a fresh module to clear the positronApi cache
      vi.resetModules();
      const mod = await import("src/utils/vscode");
      const result = await mod.getPreferredRuntimeFromPositron("python");
      expect(result).toBeUndefined();
    });
  });

  describe("Python interpreter from VSCode", () => {
    it("calls commands.executeCommand('python.interpreterPath', { workspaceFolder })", async () => {
      mockPositronRuntime.getPreferredRuntime.mockRejectedValue(
        new Error("not available"),
      );
      vi.mocked(commands.executeCommand).mockResolvedValue(
        "/usr/bin/python3" as any,
      );

      await getPythonInterpreterPath();

      expect(commands.executeCommand).toHaveBeenCalledWith(
        "python.interpreterPath",
        { workspaceFolder: workspace.workspaceFolders![0] },
      );
    });

    it("returns undefined when no workspace folders exist", async () => {
      mockPositronRuntime.getPreferredRuntime.mockRejectedValue(
        new Error("not available"),
      );
      const origFolders = workspace.workspaceFolders;
      workspace.workspaceFolders = [];

      await getPythonInterpreterPath();

      // Should not call executeCommand when no workspace
      const pythonCalls = vi
        .mocked(commands.executeCommand)
        .mock.calls.filter(
          (call) => call[0] === "python.interpreterPath",
        );
      expect(pythonCalls).toHaveLength(0);

      workspace.workspaceFolders = origFolders;
    });
  });

  describe("R interpreter from VSCode config", () => {
    it("reads workspace.getConfiguration('r.rpath').get(osType)", async () => {
      // Make Positron unavailable
      mockPositronRuntime.getPreferredRuntime.mockRejectedValue(
        new Error("not available"),
      );

      const mockGet = vi.fn().mockReturnValue("/usr/local/bin/R");
      vi.mocked(workspace.getConfiguration).mockReturnValue({
        get: mockGet,
        has: vi.fn(),
        inspect: vi.fn(),
        update: vi.fn(),
      } as any);
      vi.mocked(fileExists).mockResolvedValue(true);

      await getRInterpreterPath();

      expect(workspace.getConfiguration).toHaveBeenCalledWith("r.rpath");
      // The OS type depends on process.platform
      const expectedKey =
        process.platform === "darwin"
          ? "mac"
          : process.platform === "win32"
            ? "windows"
            : "linux";
      expect(mockGet).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe("Fallback order", () => {
    it("prefers Positron over VSCode for Python", async () => {
      mockPositronRuntime.getPreferredRuntime.mockResolvedValue({
        runtimePath: "/positron/python",
      });
      vi.mocked(commands.executeCommand).mockResolvedValue(
        "/vscode/python" as any,
      );

      const result = await getPythonInterpreterPath();

      expect(result?.pythonPath).toBe("/positron/python");
      // Should not fall through to VSCode command
      const pythonCalls = vi
        .mocked(commands.executeCommand)
        .mock.calls.filter(
          (call) => call[0] === "python.interpreterPath",
        );
      expect(pythonCalls).toHaveLength(0);
    });

    it("falls back to VSCode when Positron is unavailable for Python", async () => {
      mockPositronRuntime.getPreferredRuntime.mockRejectedValue(
        new Error("no runtime"),
      );
      vi.mocked(commands.executeCommand).mockResolvedValue(
        "/vscode/python3" as any,
      );

      const result = await getPythonInterpreterPath();

      expect(result?.pythonPath).toBe("/vscode/python3");
    });
  });
});
