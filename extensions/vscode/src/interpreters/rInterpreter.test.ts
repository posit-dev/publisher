// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { detectRInterpreter } from "./rInterpreter";

const mockExecFile = vi.fn();

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
    mockExecFile.mockReset();
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

  test("detects version when R --version returns non-zero exit with valid output", async () => {
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          // Some platforms return non-zero but still output the version
          cb(
            new Error("exit code 1"),
            "",
            "R version 4.1.3 (2022-03-10) -- \"One Push-Up\"\n",
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
    expect(result.config.version).toBe("4.1.3");
  });

  test("returns empty version when R output does not match version regex", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, "some unexpected output\n", "");
      },
    );

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.version).toBe("");
  });

  test("returns absolute lockfile path when outside projectDir", async () => {
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
          // renv returns a path outside the project directory
          cb(null, '[1] "/other/location/renv.lock"\n', "");
        },
      );
    mockFileExistsResult = true;

    const result = await detectRInterpreter("/project", "/usr/bin/R");
    expect(result.config.packageFile).toBe("/other/location/renv.lock");
  });

  test("falls back to default lockfile when renv output is unparseable", async () => {
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
          // renv succeeds but output doesn't match expected format
          cb(null, "Warning: some renv message\n", "");
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
