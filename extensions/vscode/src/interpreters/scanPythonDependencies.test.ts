// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  runPythonScanScript,
  scanPythonDependencies,
} from "./scanPythonDependencies";

// --- Mocks ---

const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

const mockWriteFile = vi.fn();
const mockUnlink = vi.fn();
const mockMkdir = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// --- Test Helpers ---

function setupExecFileSuccess(
  requirements: string[] = ["numpy==1.22.3", "pandas==1.4.0"],
  incomplete: string[] = [],
) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      const output = JSON.stringify({ requirements, incomplete });
      cb(null, output, "");
    },
  );
}

function setupExecFileError(stderr: string) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      cb(new Error("exit code 1"), "", stderr);
    },
  );
}

// --- Tests ---

describe("runPythonScanScript", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  test("parses JSON output from Python script correctly", async () => {
    setupExecFileSuccess(["numpy==1.22.3", "pandas==1.4.0"], ["unknown_pkg"]);

    const result = await runPythonScanScript("/project", "/usr/bin/python3");

    expect(result).toEqual({
      requirements: ["numpy==1.22.3", "pandas==1.4.0"],
      incomplete: ["unknown_pkg"],
    });
  });

  test("passes correct args to Python", async () => {
    setupExecFileSuccess();

    await runPythonScanScript("/project", "/usr/bin/python3");

    expect(mockExecFile).toHaveBeenCalledOnce();
    const [cmd, args, opts] = mockExecFile.mock.calls[0]!;
    expect(cmd).toBe("/usr/bin/python3");
    expect(args[0]).toBe("-E");
    expect(args[1]).toMatch(/publisher-pydeps-.*\.py$/);
    expect(args[2]).toBe("/project");
    expect(opts.timeout).toBe(60_000);
  });

  test("uses the specified Python executable path", async () => {
    setupExecFileSuccess();

    await runPythonScanScript("/project", "/custom/path/python");

    const [cmd] = mockExecFile.mock.calls[0]!;
    expect(cmd).toBe("/custom/path/python");
  });

  test("handles incomplete imports in output", async () => {
    setupExecFileSuccess(
      ["numpy==1.22.3", "unknown_import"],
      ["unknown_import"],
    );

    const result = await runPythonScanScript("/project", "/usr/bin/python3");

    expect(result.requirements).toContain("unknown_import");
    expect(result.incomplete).toEqual(["unknown_import"]);
  });

  test("rejects with descriptive error on Python execution failure", async () => {
    setupExecFileError("ModuleNotFoundError: No module named 'xyz'");

    await expect(
      runPythonScanScript("/project", "/usr/bin/python3"),
    ).rejects.toThrow("Python scan failed: ModuleNotFoundError");
  });

  test("rejects with generic error when stderr is empty", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error("Command failed"), "", "");
      },
    );

    await expect(
      runPythonScanScript("/project", "/usr/bin/python3"),
    ).rejects.toThrow("Python scan failed: Command failed");
  });

  test("rejects on invalid JSON output", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, "not valid json{", "");
      },
    );

    await expect(
      runPythonScanScript("/project", "/usr/bin/python3"),
    ).rejects.toThrow("Failed to parse Python scan output");
  });

  test("handles Python script returning error in JSON", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const output = JSON.stringify({ error: "Failed to scan project" });
        cb(null, output, "");
      },
    );

    await expect(
      runPythonScanScript("/project", "/usr/bin/python3"),
    ).rejects.toThrow("Python scan failed: Failed to scan project");
  });

  test("cleans up temp file after success", async () => {
    setupExecFileSuccess();

    await runPythonScanScript("/project", "/usr/bin/python3");

    expect(mockUnlink).toHaveBeenCalledOnce();
    const [tmpPath] = mockUnlink.mock.calls[0]!;
    expect(tmpPath).toMatch(/publisher-pydeps-.*\.py$/);
  });

  test("cleans up temp file after failure", async () => {
    setupExecFileError("Error occurred");

    await expect(
      runPythonScanScript("/project", "/usr/bin/python3"),
    ).rejects.toThrow();

    expect(mockUnlink).toHaveBeenCalledOnce();
  });

  test("writes temp file before executing Python", async () => {
    setupExecFileSuccess();

    await runPythonScanScript("/project", "/usr/bin/python3");

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const [tmpPath, script] = mockWriteFile.mock.calls[0]!;
    expect(tmpPath).toMatch(/publisher-pydeps-.*\.py$/);
    expect(script).toContain("import ast");
    expect(script).toContain("import json");
    expect(script).toContain("def scan_project");
  });

  test("writes embedded Python script to temp file", async () => {
    setupExecFileSuccess();

    await runPythonScanScript("/project", "/usr/bin/python3");

    const [, script] = mockWriteFile.mock.calls[0]!;
    expect(script).toContain("import ast");
    expect(script).toContain("import json");
    expect(script).toContain("def scan_project");
    expect(script).toContain("importlib.metadata");
  });

  test("handles empty requirements", async () => {
    setupExecFileSuccess([], []);

    const result = await runPythonScanScript("/project", "/usr/bin/python3");

    expect(result.requirements).toEqual([]);
    expect(result.incomplete).toEqual([]);
  });

  test("handles whitespace in JSON output", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const output = `  \n${JSON.stringify({ requirements: ["numpy==1.22.3"], incomplete: [] })}  \n  `;
        cb(null, output, "");
      },
    );

    const result = await runPythonScanScript("/project", "/usr/bin/python3");

    expect(result.requirements).toEqual(["numpy==1.22.3"]);
  });
});

describe("scanPythonDependencies", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  test("writes requirements.txt with correct header format and returns result", async () => {
    setupExecFileSuccess(["numpy==1.22.3", "pandas==1.4.0"], []);

    const result = await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "requirements.txt",
    );

    // Check file was written
    expect(mockWriteFile).toHaveBeenCalledTimes(2); // temp file + requirements.txt
    const [reqPath, content] = mockWriteFile.mock.calls[1]!;
    expect(reqPath).toBe(path.join("/project", "requirements.txt"));
    expect(content).toContain(
      "# requirements.txt auto-generated by Posit Publisher",
    );
    expect(content).toContain("# using /usr/bin/python3");
    expect(content).toContain("numpy==1.22.3");
    expect(content).toContain("pandas==1.4.0");
    expect(content).toMatch(/numpy==1\.22\.3\npandas==1\.4\.0\n$/);

    // Check result
    expect(result).toEqual({
      requirements: ["numpy==1.22.3", "pandas==1.4.0"],
      incomplete: [],
      python: "/usr/bin/python3",
    });
  });

  test("uses custom save name when provided", async () => {
    setupExecFileSuccess(["numpy==1.22.3"], []);

    await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "custom_reqs.txt",
    );

    const [reqPath] = mockWriteFile.mock.calls[1]!;
    expect(reqPath).toBe(path.join("/project", "custom_reqs.txt"));
  });

  test("supports save name with subdirectory path", async () => {
    setupExecFileSuccess(["numpy==1.22.3"], []);

    await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "subdir/requirements.txt",
    );

    const [reqPath] = mockWriteFile.mock.calls[1]!;
    expect(reqPath).toBe(path.join("/project", "subdir", "requirements.txt"));
    expect(mockMkdir).toHaveBeenCalledWith(path.join("/project", "subdir"), {
      recursive: true,
    });
  });

  test("rejects invalid save name with '..'", async () => {
    await expect(
      scanPythonDependencies("/project", "/usr/bin/python3", ".."),
    ).rejects.toThrow("Invalid requirements filename");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  test("rejects save name with directory traversal", async () => {
    await expect(
      scanPythonDependencies("/project", "/usr/bin/python3", "../etc/passwd"),
    ).rejects.toThrow("Invalid requirements path");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  test("rejects absolute save name path", async () => {
    await expect(
      scanPythonDependencies("/project", "/usr/bin/python3", "/etc/passwd"),
    ).rejects.toThrow("Invalid requirements path");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  test("rejects multi-level directory traversal", async () => {
    await expect(
      scanPythonDependencies(
        "/project",
        "/usr/bin/python3",
        "../../etc/passwd",
      ),
    ).rejects.toThrow("Invalid requirements path");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  test("accepts save name starting with '..' that is not traversal", async () => {
    setupExecFileSuccess(["numpy==1.22.3"], []);

    await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "..foo/requirements.txt",
    );

    const [reqPath] = mockWriteFile.mock.calls[1]!;
    expect(reqPath).toBe(path.join("/project", "..foo", "requirements.txt"));
  });

  test("returns correct python field in result", async () => {
    setupExecFileSuccess(["numpy==1.22.3"], []);

    const result = await scanPythonDependencies(
      "/project",
      "/custom/path/python",
      "requirements.txt",
    );

    expect(result.python).toBe("/custom/path/python");
  });

  test("does not write file when saveName is undefined", async () => {
    setupExecFileSuccess(["numpy==1.22.3"], []);

    const result = await scanPythonDependencies("/project", "/usr/bin/python3");

    // Only temp file should be written
    expect(mockWriteFile).toHaveBeenCalledOnce();
    expect(result).toEqual({
      requirements: ["numpy==1.22.3"],
      incomplete: [],
      python: "/usr/bin/python3",
    });
  });

  test("does not write file when saveName is empty string", async () => {
    setupExecFileSuccess(["numpy==1.22.3"], []);

    const result = await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "",
    );

    // Only temp file should be written
    expect(mockWriteFile).toHaveBeenCalledOnce();
    expect(result.python).toBe("/usr/bin/python3");
  });

  test("propagates errors from runPythonScanScript", async () => {
    setupExecFileError("Python failed");

    await expect(
      scanPythonDependencies(
        "/project",
        "/usr/bin/python3",
        "requirements.txt",
      ),
    ).rejects.toThrow("Python scan failed");
  });

  test("includes incomplete imports in result", async () => {
    setupExecFileSuccess(["numpy==1.22.3", "unknown_pkg"], ["unknown_pkg"]);

    const result = await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "requirements.txt",
    );

    expect(result.incomplete).toEqual(["unknown_pkg"]);
  });

  test("writes requirements.txt with newline at end", async () => {
    setupExecFileSuccess(["numpy==1.22.3"], []);

    await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "requirements.txt",
    );

    const [, content] = mockWriteFile.mock.calls[1]!;
    expect(content).toMatch(/\n$/);
  });

  test("formats requirements.txt correctly with multiple packages", async () => {
    setupExecFileSuccess(
      ["numpy==1.22.3", "pandas==1.4.0", "scipy==1.8.0"],
      [],
    );

    await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "requirements.txt",
    );

    const [, content] = mockWriteFile.mock.calls[1]!;
    const lines = content.split("\n");
    expect(lines[0]).toBe(
      "# requirements.txt auto-generated by Posit Publisher",
    );
    expect(lines[1]).toBe("# using /usr/bin/python3");
    expect(lines[2]).toBe("numpy==1.22.3");
    expect(lines[3]).toBe("pandas==1.4.0");
    expect(lines[4]).toBe("scipy==1.8.0");
    expect(lines[5]).toBe("");
  });

  test("handles empty requirements list", async () => {
    setupExecFileSuccess([], []);

    const result = await scanPythonDependencies(
      "/project",
      "/usr/bin/python3",
      "requirements.txt",
    );

    expect(result.requirements).toEqual([]);
    const [, content] = mockWriteFile.mock.calls[1]!;
    expect(content).toBe(
      "# requirements.txt auto-generated by Posit Publisher\n# using /usr/bin/python3\n\n",
    );
  });
});
