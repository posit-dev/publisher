// Copyright (C) 2025 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

vi.mock("vscode", () => ({
  env: { appName: "VSCode", clipboard: { writeText: vi.fn() } },
  version: "1.85.0",
  window: {
    withProgress: vi.fn(),
    showSaveDialog: vi.fn(),
    showInformationMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      show: vi.fn(),
    })),
  },
  workspace: {
    workspaceFolders: [],
    fs: { writeFile: vi.fn() },
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
}));

vi.mock("src/logging", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  extractSettled,
  parseRVersion,
  getCommandVersion,
  formatDiagnosticBundle,
  DiagnosticInfo,
} from "./diagnosticBundle";

describe("extractSettled", () => {
  test("returns trimmed value for fulfilled result", () => {
    const result: PromiseSettledResult<string> = {
      status: "fulfilled",
      value: "  3.12.0  \n",
    };
    expect(extractSettled(result)).toBe("3.12.0");
  });

  test("returns 'not found' for rejected result", () => {
    const result: PromiseSettledResult<string> = {
      status: "rejected",
      reason: new Error("command not found"),
    };
    expect(extractSettled(result)).toBe("not found");
  });

  test("returns 'not found' for fulfilled but empty result", () => {
    const result: PromiseSettledResult<string> = {
      status: "fulfilled",
      value: "",
    };
    expect(extractSettled(result)).toBe("not found");
  });

  test("applies parser function when provided", () => {
    const result: PromiseSettledResult<string> = {
      status: "fulfilled",
      value: "R version 4.3.1 (2023-06-16) -- Fresh Dew",
    };
    expect(extractSettled(result, parseRVersion)).toBe("4.3.1");
  });

  test("does not apply parser for rejected result", () => {
    const parser = vi.fn();
    const result: PromiseSettledResult<string> = {
      status: "rejected",
      reason: new Error("fail"),
    };
    expect(extractSettled(result, parser)).toBe("not found");
    expect(parser).not.toHaveBeenCalled();
  });
});

describe("parseRVersion", () => {
  test("extracts version from standard R --version output", () => {
    const output =
      'R version 4.3.1 (2023-06-16) -- "Beagle Scouts"\nCopyright (C) 2023 The R Foundation';
    expect(parseRVersion(output)).toBe("4.3.1");
  });

  test("extracts version from single-line output", () => {
    expect(parseRVersion("R version 4.2.0 (2022-04-24)")).toBe("4.2.0");
  });

  test("returns first line when no match", () => {
    expect(parseRVersion("some unexpected output\nsecond line")).toBe(
      "some unexpected output",
    );
  });

  test("handles empty string", () => {
    expect(parseRVersion("")).toBe("");
  });
});

describe("getCommandVersion", () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("resolves with stdout on success", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, "3.12.0\n", "");
      },
    );

    const result = await getCommandVersion("python3", ["-c", "print(1)"]);
    expect(result).toBe("3.12.0");
  });

  test("combines stdout and stderr", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, "", "R version 4.3.1 (2023-06-16)\n");
      },
    );

    const result = await getCommandVersion("R", ["--version"]);
    expect(result).toBe("R version 4.3.1 (2023-06-16)");
  });

  test("rejects on error", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error("command not found"), "", "");
      },
    );

    await expect(
      getCommandVersion("nonexistent", ["--version"]),
    ).rejects.toThrow("command not found");
  });
});

describe("formatDiagnosticBundle", () => {
  test("formats all fields into readable text", () => {
    const info: DiagnosticInfo = {
      extensionVersion: "1.37.19",
      platform: "linux",
      arch: "x64",
      ide: "Visual Studio Code",
      ideVersion: "1.85.0",
      pythonVersion: "3.12.0",
      rVersion: "4.3.1",
      quartoVersion: "1.4.550",
      workspaceFolders: ["/home/user/project"],
      timestamp: "2025-01-15T10:30:00.000Z",
    };

    const result = formatDiagnosticBundle(info);

    expect(result).toContain("Posit Publisher Diagnostic Bundle");
    expect(result).toContain("Posit Publisher Version: 1.37.19");
    expect(result).toContain("Platform: linux x64");
    expect(result).toContain("IDE: Visual Studio Code 1.85.0");
    expect(result).toContain("Python: 3.12.0");
    expect(result).toContain("R: 4.3.1");
    expect(result).toContain("Quarto: 1.4.550");
    expect(result).toContain("- /home/user/project");
    expect(result).toContain("2025-01-15T10:30:00.000Z");
  });

  test("handles not found versions", () => {
    const info: DiagnosticInfo = {
      extensionVersion: "1.0.0",
      platform: "darwin",
      arch: "arm64",
      ide: "VSCode",
      ideVersion: "1.80.0",
      pythonVersion: "not found",
      rVersion: "not found",
      quartoVersion: "not found",
      workspaceFolders: [],
      timestamp: "2025-01-01T00:00:00.000Z",
    };

    const result = formatDiagnosticBundle(info);

    expect(result).toContain("Python: not found");
    expect(result).toContain("R: not found");
    expect(result).toContain("Quarto: not found");
  });

  test("handles multiple workspace folders", () => {
    const info: DiagnosticInfo = {
      extensionVersion: "1.0.0",
      platform: "win32",
      arch: "x64",
      ide: "VSCode",
      ideVersion: "1.80.0",
      pythonVersion: "3.11.0",
      rVersion: "4.2.0",
      quartoVersion: "1.3.0",
      workspaceFolders: ["/workspace/project1", "/workspace/project2"],
      timestamp: "2025-01-01T00:00:00.000Z",
    };

    const result = formatDiagnosticBundle(info);

    expect(result).toContain("- /workspace/project1");
    expect(result).toContain("- /workspace/project2");
  });
});
