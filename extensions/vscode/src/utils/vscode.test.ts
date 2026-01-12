// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, beforeEach, test, vi } from "vitest";

// Mock the files module
vi.mock("./files", () => ({
  fileExists: vi.fn(),
  isDir: vi.fn(),
}));

// Mock the variables module
vi.mock("./variables", () => ({
  substituteVariables: vi.fn((s: string) => s),
}));

// Mock the throttle module
vi.mock("./throttle", () => ({
  delay: vi.fn(() => Promise.resolve()),
}));

// Mock vscode module
vi.mock("vscode", () => {
  const uriMock = {
    file: vi.fn((path: string) => ({
      fsPath: path,
      path: path,
    })),
    joinPath: vi.fn((base: { fsPath: string }, ...segments: string[]) => {
      const joined = [base.fsPath, ...segments].join("/");
      return { fsPath: joined, path: joined };
    }),
  };

  return {
    Uri: uriMock,
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
      getConfiguration: vi.fn(),
    },
    commands: {
      executeCommand: vi.fn(),
    },
  };
});

// Import after mocks are set up
import { workspace, commands } from "vscode";
import { fileExists, isDir } from "./files";
import { substituteVariables } from "./variables";
import { getPythonInterpreterPath, getRInterpreterPath } from "./vscode";
import { PythonExecutable, RExecutable } from "src/types/shared";

describe("Interpreter Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to default behavior
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(isDir).mockResolvedValue(false);
    vi.mocked(substituteVariables).mockImplementation((s: string) => s);
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: vi.fn(),
    } as unknown as ReturnType<typeof workspace.getConfiguration>);
    vi.mocked(commands.executeCommand).mockResolvedValue(undefined);
  });

  describe("getPythonInterpreterPath", () => {
    describe("from VS Code Python extension", () => {
      test("returns Python path from python.interpreterPath command", async () => {
        // Setup: python.interpreterPath returns a path
        vi.mocked(commands.executeCommand).mockResolvedValue(
          "/usr/bin/python3",
        );
        vi.mocked(isDir).mockResolvedValue(false);

        const result = await getPythonInterpreterPath();

        expect(commands.executeCommand).toHaveBeenCalledWith(
          "python.interpreterPath",
          { workspaceFolder: workspace.workspaceFolders![0] },
        );
        expect(result).toBeInstanceOf(PythonExecutable);
        expect(result?.pythonPath).toBe("/usr/bin/python3");
      });

      test("handles virtual environment directory - finds bin/python", async () => {
        // Setup: python.interpreterPath returns a venv directory
        vi.mocked(commands.executeCommand).mockResolvedValue(
          "/home/user/project/.venv",
        );
        vi.mocked(isDir).mockResolvedValue(true);
        vi.mocked(fileExists).mockImplementation((uri) =>
          Promise.resolve(
            (uri as { fsPath: string }).fsPath.endsWith("bin/python"),
          ),
        );

        const result = await getPythonInterpreterPath();

        expect(result).toBeInstanceOf(PythonExecutable);
        expect(result?.pythonPath).toBe("/home/user/project/.venv/bin/python");
      });

      test("handles virtual environment directory - finds bin/python3", async () => {
        vi.mocked(commands.executeCommand).mockResolvedValue(
          "/home/user/project/.venv",
        );
        vi.mocked(isDir).mockResolvedValue(true);
        vi.mocked(fileExists).mockImplementation((uri) =>
          Promise.resolve(
            (uri as { fsPath: string }).fsPath.endsWith("bin/python3"),
          ),
        );

        const result = await getPythonInterpreterPath();

        expect(result).toBeInstanceOf(PythonExecutable);
        expect(result?.pythonPath).toBe("/home/user/project/.venv/bin/python3");
      });

      test("handles Windows virtual environment - finds Scripts/python.exe", async () => {
        vi.mocked(commands.executeCommand).mockResolvedValue(
          "C:\\Users\\user\\project\\.venv",
        );
        vi.mocked(isDir).mockResolvedValue(true);
        vi.mocked(fileExists).mockImplementation((uri) =>
          Promise.resolve(
            (uri as { fsPath: string }).fsPath.endsWith("Scripts/python.exe"),
          ),
        );

        const result = await getPythonInterpreterPath();

        expect(result).toBeInstanceOf(PythonExecutable);
        expect(result?.pythonPath).toBe(
          "C:\\Users\\user\\project\\.venv/Scripts/python.exe",
        );
      });

      test("substitutes variables in configured path", async () => {
        vi.mocked(commands.executeCommand).mockResolvedValue(
          "${workspaceFolder}/.venv/bin/python",
        );
        vi.mocked(substituteVariables).mockReturnValue(
          "/workspace/.venv/bin/python",
        );
        vi.mocked(isDir).mockResolvedValue(false);

        const result = await getPythonInterpreterPath();

        expect(substituteVariables).toHaveBeenCalledWith(
          "${workspaceFolder}/.venv/bin/python",
          true,
        );
        expect(result?.pythonPath).toBe("/workspace/.venv/bin/python");
      });

      test("returns undefined when python.interpreterPath command fails", async () => {
        vi.mocked(commands.executeCommand).mockRejectedValue(
          new Error("Command not found"),
        );

        const result = await getPythonInterpreterPath();

        expect(result).toBeUndefined();
      });

      test("returns undefined when python.interpreterPath returns undefined", async () => {
        vi.mocked(commands.executeCommand).mockResolvedValue(undefined);

        const result = await getPythonInterpreterPath();

        expect(result).toBeUndefined();
      });
    });
  });

  describe("getRInterpreterPath", () => {
    describe("from VS Code R extension config", () => {
      test("returns R path from r.rpath.mac config on darwin", async () => {
        // Mock platform
        const originalPlatform = process.platform;
        Object.defineProperty(process, "platform", { value: "darwin" });

        const mockConfigGet = vi.fn().mockReturnValue("/usr/local/bin/R");
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);
        vi.mocked(fileExists).mockResolvedValue(true);

        const result = await getRInterpreterPath();

        expect(workspace.getConfiguration).toHaveBeenCalledWith("r.rpath");
        expect(mockConfigGet).toHaveBeenCalledWith("mac");
        expect(result).toBeInstanceOf(RExecutable);
        expect(result?.rPath).toBe("/usr/local/bin/R");

        // Restore platform
        Object.defineProperty(process, "platform", { value: originalPlatform });
      });

      test("returns R path from r.rpath.windows config on win32", async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, "platform", { value: "win32" });

        const mockConfigGet = vi
          .fn()
          .mockReturnValue("C:\\Program Files\\R\\R-4.3.0\\bin\\R.exe");
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);
        vi.mocked(fileExists).mockResolvedValue(true);

        const result = await getRInterpreterPath();

        expect(workspace.getConfiguration).toHaveBeenCalledWith("r.rpath");
        expect(mockConfigGet).toHaveBeenCalledWith("windows");
        expect(result).toBeInstanceOf(RExecutable);
        expect(result?.rPath).toBe("C:\\Program Files\\R\\R-4.3.0\\bin\\R.exe");

        Object.defineProperty(process, "platform", { value: originalPlatform });
      });

      test("returns R path from r.rpath.linux config on linux", async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, "platform", { value: "linux" });

        const mockConfigGet = vi.fn().mockReturnValue("/usr/bin/R");
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);
        vi.mocked(fileExists).mockResolvedValue(true);

        const result = await getRInterpreterPath();

        expect(workspace.getConfiguration).toHaveBeenCalledWith("r.rpath");
        expect(mockConfigGet).toHaveBeenCalledWith("linux");
        expect(result).toBeInstanceOf(RExecutable);
        expect(result?.rPath).toBe("/usr/bin/R");

        Object.defineProperty(process, "platform", { value: originalPlatform });
      });

      test("returns undefined when r.rpath config is not set", async () => {
        const mockConfigGet = vi.fn().mockReturnValue(undefined);
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);

        const result = await getRInterpreterPath();

        expect(result).toBeUndefined();
      });

      test("returns undefined when configured R path does not exist", async () => {
        const mockConfigGet = vi.fn().mockReturnValue("/nonexistent/R");
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);
        vi.mocked(fileExists).mockResolvedValue(false);

        const result = await getRInterpreterPath();

        expect(result).toBeUndefined();
      });
    });

    describe("from PATH environment", () => {
      test("finds R in PATH on Unix", async () => {
        const originalPlatform = process.platform;
        const originalPath = process.env.PATH;
        Object.defineProperty(process, "platform", { value: "darwin" });
        process.env.PATH = "/usr/local/bin:/usr/bin:/bin";

        // No VS Code config
        const mockConfigGet = vi.fn().mockReturnValue(undefined);
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);

        // R exists in /usr/local/bin
        vi.mocked(fileExists).mockImplementation((uri) =>
          Promise.resolve(
            (uri as { fsPath: string }).fsPath === "/usr/local/bin/R",
          ),
        );

        const result = await getRInterpreterPath();

        expect(result).toBeInstanceOf(RExecutable);
        expect(result?.rPath).toBe("/usr/local/bin/R");

        Object.defineProperty(process, "platform", { value: originalPlatform });
        process.env.PATH = originalPath;
      });

      test("finds R.exe in PATH on Windows", async () => {
        const originalPlatform = process.platform;
        const originalPath = process.env.PATH;
        Object.defineProperty(process, "platform", { value: "win32" });
        process.env.PATH =
          "C:\\Windows\\System32;C:\\Program Files\\R\\R-4.3.0\\bin";

        // No VS Code config
        const mockConfigGet = vi.fn().mockReturnValue(undefined);
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);

        // R.exe exists in R bin directory
        vi.mocked(fileExists).mockImplementation((uri) =>
          Promise.resolve(
            (uri as { fsPath: string }).fsPath.includes("R-4.3.0"),
          ),
        );

        const result = await getRInterpreterPath();

        expect(result).toBeInstanceOf(RExecutable);
        expect(result?.rPath).toContain("R.exe");

        Object.defineProperty(process, "platform", { value: originalPlatform });
        process.env.PATH = originalPath;
      });

      test("returns undefined when R is not in PATH", async () => {
        const originalPath = process.env.PATH;
        process.env.PATH = "/usr/local/bin:/usr/bin:/bin";

        // No VS Code config
        const mockConfigGet = vi.fn().mockReturnValue(undefined);
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);

        // R doesn't exist anywhere
        vi.mocked(fileExists).mockResolvedValue(false);

        const result = await getRInterpreterPath();

        expect(result).toBeUndefined();

        process.env.PATH = originalPath;
      });

      test("returns undefined when PATH is not set", async () => {
        const originalPath = process.env.PATH;
        delete process.env.PATH;

        // No VS Code config
        const mockConfigGet = vi.fn().mockReturnValue(undefined);
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);

        const result = await getRInterpreterPath();

        expect(result).toBeUndefined();

        process.env.PATH = originalPath;
      });
    });

    describe("fallback order", () => {
      test("prefers VS Code config over PATH", async () => {
        const originalPath = process.env.PATH;
        process.env.PATH = "/usr/bin";

        // VS Code config is set
        const mockConfigGet = vi.fn().mockReturnValue("/custom/path/R");
        vi.mocked(workspace.getConfiguration).mockReturnValue({
          get: mockConfigGet,
        } as unknown as ReturnType<typeof workspace.getConfiguration>);

        // Both paths exist
        vi.mocked(fileExists).mockResolvedValue(true);

        const result = await getRInterpreterPath();

        // Should use VS Code config, not PATH
        expect(result?.rPath).toBe("/custom/path/R");

        process.env.PATH = originalPath;
      });
    });
  });
});
