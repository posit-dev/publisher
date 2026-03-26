// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  detectPythonInterpreter,
  clearPythonVersionCache,
} from "./pythonInterpreter";

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

let mockFileExistsResult = false;
vi.mock("./fsUtils", () => ({
  fileExistsAt: vi.fn(() => Promise.resolve(mockFileExistsResult)),
}));

// Mock getPythonRequires so it doesn't try to read real files
vi.mock("./pythonRequires", () => ({
  getPythonRequires: vi.fn(() => Promise.resolve("")),
}));

describe("detectPythonInterpreter", () => {
  beforeEach(() => {
    clearPythonVersionCache();
    mockFileExistsResult = false;
    mockExecFile.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns empty config when no path provided and PATH lookup fails", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(new Error("not found"), "");
      },
    );

    const result = await detectPythonInterpreter("/project");
    expect(result.config.version).toBe("");
    expect(result.config.packageFile).toBe("");
    expect(result.config.packageManager).toBe("");
    expect(result.preferredPath).toBe("");
  });

  test("falls back to python3 on PATH when no preferred path given", async () => {
    mockExecFile.mockImplementation(
      (
        cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        if (cmd === "python3") {
          cb(null, "3.12.0\n");
        } else {
          cb(new Error("not found"), "");
        }
      },
    );

    const result = await detectPythonInterpreter("/project");
    expect(result.config.version).toBe("3.12.0");
    expect(result.preferredPath).toBe("python3");
  });

  test("falls back to python on PATH when python3 is not found", async () => {
    mockExecFile.mockImplementation(
      (
        cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        if (cmd === "python") {
          cb(null, "3.9.7\n");
        } else {
          cb(new Error("not found"), "");
        }
      },
    );

    const result = await detectPythonInterpreter("/project");
    expect(result.config.version).toBe("3.9.7");
    expect(result.preferredPath).toBe("python");
  });

  test("returns empty config when python fails to execute", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(new Error("not found"), "");
      },
    );

    const result = await detectPythonInterpreter(
      "/project",
      "/usr/bin/python3",
    );
    expect(result.config.version).toBe("");
  });

  test("detects version from python executable", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(null, "3.11.5\n");
      },
    );

    const result = await detectPythonInterpreter(
      "/project",
      "/usr/bin/python3",
    );
    expect(result.config.version).toBe("3.11.5");
    expect(result.config.packageManager).toBe("auto");
    expect(result.preferredPath).toBe("/usr/bin/python3");
  });

  test("returns requirements.txt as packageFile when present", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(null, "3.10.0\n");
      },
    );
    mockFileExistsResult = true;

    const result = await detectPythonInterpreter(
      "/project",
      "/usr/bin/python3",
    );
    expect(result.config.packageFile).toBe("requirements.txt");
  });

  test("returns empty packageFile when requirements.txt not present", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(null, "3.10.0\n");
      },
    );
    mockFileExistsResult = false;

    const result = await detectPythonInterpreter(
      "/project",
      "/usr/bin/python3",
    );
    expect(result.config.packageFile).toBe("");
  });

  test("returns empty config when python outputs empty stdout", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(null, "");
      },
    );

    const result = await detectPythonInterpreter(
      "/project",
      "/usr/bin/python3",
    );
    expect(result.config.version).toBe("");
  });

  test("returns empty config when python outputs only whitespace", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        cb(null, "   \n  ");
      },
    );

    const result = await detectPythonInterpreter(
      "/project",
      "/usr/bin/python3",
    );
    expect(result.config.version).toBe("");
  });

  test("caches version for non-shim paths", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        callCount++;
        cb(null, "3.10.0\n");
      },
    );

    await detectPythonInterpreter("/project", "/usr/bin/python3");
    await detectPythonInterpreter("/project", "/usr/bin/python3");
    expect(callCount).toBe(1);
  });

  test("does not cache version for pyenv shims", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void,
      ) => {
        callCount++;
        cb(null, "3.10.0\n");
      },
    );

    await detectPythonInterpreter(
      "/project",
      "/home/user/.pyenv/shims/python3",
    );
    await detectPythonInterpreter(
      "/project",
      "/home/user/.pyenv/shims/python3",
    );
    expect(callCount).toBe(2);
  });
});
