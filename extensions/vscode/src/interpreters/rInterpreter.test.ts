// Copyright (C) 2025 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { detectRInterpreter } from "./rInterpreter";

let mockExecFile: ReturnType<typeof vi.fn>;

vi.mock("child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

vi.mock("vscode", () => ({
  Uri: {
    file: (path: string) => ({ fsPath: path, path }),
    joinPath: (base: { path: string }, ...segments: string[]) => {
      const joined = [base.path, ...segments].join("/");
      return { fsPath: joined, path: joined };
    },
  },
  workspace: {
    fs: {
      stat: vi.fn(),
    },
  },
}));

let mockFileExistsResult = false;
vi.mock("src/utils/files", () => ({
  fileExists: vi.fn(() => Promise.resolve(mockFileExistsResult)),
}));

describe("detectRInterpreter", () => {
  beforeEach(() => {
    mockFileExistsResult = false;
    mockExecFile = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns empty config when no path provided", async () => {
    const result = await detectRInterpreter("/project");
    expect(result.config.version).toBe("");
    expect(result.config.packageFile).toBe("");
    expect(result.config.packageManager).toBe("");
    expect(result.preferredPath).toBe("");
  });

  test("returns empty config when R fails to execute", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error("not found"), "", "");
      },
    );

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.version).toBe("");
  });

  test("detects version from R --version stdout", async () => {
    // First call: R --version
    // Second call: renv::paths$lockfile()
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(
            null,
            "R version 4.3.2 (2023-10-31) -- \"Eye Holes\"\n",
            "",
          );
        },
      )
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(new Error("renv not installed"), "", "");
        },
      );

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.version).toBe("4.3.2");
    expect(result.config.packageManager).toBe("renv");
    expect(result.preferredPath).toBe("/usr/bin/R");
  });

  test("detects version from R --version stderr", async () => {
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "", "R version 4.2.1 (2022-06-23)\n");
        },
      )
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(new Error("renv not installed"), "", "");
        },
      );

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.version).toBe("4.2.1");
  });

  test("uses renv lockfile path from renv::paths$lockfile()", async () => {
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "R version 4.3.0 (2023-04-21)\n", "");
        },
      )
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, '[1] "/project/custom/renv.lock"\n', "");
        },
      );
    mockFileExistsResult = true;

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.packageFile).toBe("custom/renv.lock");
  });

  test("falls back to default renv.lock when renv fails", async () => {
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "R version 4.3.0 (2023-04-21)\n", "");
        },
      )
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(new Error("renv not installed"), "", "");
        },
      );
    mockFileExistsResult = true;

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.packageFile).toBe("renv.lock");
  });

  test("returns empty packageFile when lockfile does not exist", async () => {
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "R version 4.3.0 (2023-04-21)\n", "");
        },
      )
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          cb(new Error("renv not installed"), "", "");
        },
      );
    mockFileExistsResult = false;

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.packageFile).toBe("");
  });
});
