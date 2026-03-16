// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PositronRSettings } from "../api/types/positron";
import { repoURLFromOptions, scanRPackages } from "./rPackages";

// Mock child_process.execFile
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock fs/promises
const mockWriteFile = vi.fn();
const mockUnlink = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

// Mock fsUtils
const mockFileExistsAt = vi.fn();
vi.mock("./fsUtils", () => ({
  fileExistsAt: (...args: unknown[]) => mockFileExistsAt(...args),
}));

describe("repoURLFromOptions", () => {
  test("returns CRAN URL when settings are undefined", () => {
    expect(repoURLFromOptions(undefined)).toBe("https://cloud.r-project.org");
  });

  test("returns CRAN URL for auto mode without custom PPM", () => {
    const settings: PositronRSettings = { defaultRepositories: "auto" };
    expect(repoURLFromOptions(settings)).toBe("https://cloud.r-project.org");
  });

  test("returns custom PPM URL for auto mode with custom PPM", () => {
    const settings: PositronRSettings = {
      defaultRepositories: "auto",
      packageManagerRepository: "https://my-ppm.example.com/cran/",
    };
    expect(repoURLFromOptions(settings)).toBe(
      "https://my-ppm.example.com/cran",
    );
  });

  test("returns Posit PPM URL for posit-ppm mode", () => {
    const settings: PositronRSettings = {
      defaultRepositories: "posit-ppm",
    };
    expect(repoURLFromOptions(settings)).toBe(
      "https://packagemanager.posit.co/cran/latest",
    );
  });

  test("returns RStudio URL for rstudio mode", () => {
    const settings: PositronRSettings = { defaultRepositories: "rstudio" };
    expect(repoURLFromOptions(settings)).toBe("https://cran.rstudio.com");
  });

  test("returns empty string for none mode", () => {
    const settings: PositronRSettings = { defaultRepositories: "none" };
    expect(repoURLFromOptions(settings)).toBe("");
  });

  test("returns raw URL when mode is an http URL", () => {
    const settings: PositronRSettings = {
      defaultRepositories: "https://custom-cran.example.com/repo/",
    };
    expect(repoURLFromOptions(settings)).toBe(
      "https://custom-cran.example.com/repo",
    );
  });

  test("returns empty string for unrecognized non-URL mode", () => {
    const settings: PositronRSettings = {
      defaultRepositories: "unknown-mode",
    };
    expect(repoURLFromOptions(settings)).toBe("");
  });

  test("defaults to auto when defaultRepositories is empty", () => {
    const settings: PositronRSettings = { defaultRepositories: "" };
    expect(repoURLFromOptions(settings)).toBe("https://cloud.r-project.org");
  });

  test("is case-insensitive for mode", () => {
    const settings: PositronRSettings = { defaultRepositories: "Posit-PPM" };
    expect(repoURLFromOptions(settings)).toBe(
      "https://packagemanager.posit.co/cran/latest",
    );
  });
});

describe("scanRPackages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  function setupExecFileSuccess() {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, "", "");
      },
    );
  }

  test("succeeds with default save name", async () => {
    setupExecFileSuccess();
    mockFileExistsAt.mockResolvedValue(true);

    await scanRPackages("/project", "/usr/bin/R");

    // Verify temp file was written
    expect(mockWriteFile).toHaveBeenCalledOnce();
    const [tmpPath, script] = mockWriteFile.mock.calls[0]!;
    expect(tmpPath).toMatch(/publisher-renv-.*\.R$/);
    expect(script).toContain("renv::snapshot");
    expect(script).toContain("renv.lock");

    // Verify R was invoked
    expect(mockExecFile).toHaveBeenCalledOnce();
    const [cmd, args, opts] = mockExecFile.mock.calls[0]!;
    expect(cmd).toBe("/usr/bin/R");
    expect(args).toEqual(["-s", "-f", tmpPath]);
    expect(opts.cwd).toBe("/project");

    // Verify lockfile existence was checked
    expect(mockFileExistsAt).toHaveBeenCalledWith("/project/renv.lock");

    // Verify temp file was cleaned up
    expect(mockUnlink).toHaveBeenCalledWith(tmpPath);
  });

  test("uses custom save name", async () => {
    setupExecFileSuccess();
    mockFileExistsAt.mockResolvedValue(true);

    await scanRPackages("/project", "R", "my_renv.lock");

    const [, script] = mockWriteFile.mock.calls[0]!;
    expect(script).toContain("my_renv.lock");
    expect(mockFileExistsAt).toHaveBeenCalledWith("/project/my_renv.lock");
  });

  test("supports save name with subdirectory path", async () => {
    setupExecFileSuccess();
    mockFileExistsAt.mockResolvedValue(true);

    await scanRPackages("/project", "R", ".renv/profiles/staging/renv.lock");

    const [, script] = mockWriteFile.mock.calls[0]!;
    expect(script).toContain(".renv/profiles/staging/renv.lock");
    expect(mockFileExistsAt).toHaveBeenCalledWith(
      "/project/.renv/profiles/staging/renv.lock",
    );
  });

  test("includes repository URL from positron settings", async () => {
    setupExecFileSuccess();
    mockFileExistsAt.mockResolvedValue(true);

    await scanRPackages("/project", "R", undefined, {
      defaultRepositories: "posit-ppm",
    });

    const [, script] = mockWriteFile.mock.calls[0]!;
    expect(script).toContain("https://packagemanager.posit.co/cran/latest");
  });

  test("rejects save name with directory traversal", async () => {
    await expect(
      scanRPackages("/project", "R", "../../etc/passwd"),
    ).rejects.toThrow("Invalid lockfile path");
  });

  test("rejects save name that is just '..'", async () => {
    await expect(scanRPackages("/project", "R", "..")).rejects.toThrow(
      "Invalid lockfile name",
    );
  });

  test("throws when R script execution fails", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error("exit code 1"), "", "Error in renv::init");
      },
    );

    await expect(scanRPackages("/project", "R")).rejects.toThrow(
      "R scan failed: Error in renv::init",
    );

    // Temp file should still be cleaned up
    expect(mockUnlink).toHaveBeenCalledOnce();
  });

  test("throws when lockfile is not created after execution", async () => {
    setupExecFileSuccess();
    mockFileExistsAt.mockResolvedValue(false);

    await expect(scanRPackages("/project", "R")).rejects.toThrow(
      "renv could not create lockfile",
    );
  });

  test("cleans up temp file even when execution fails", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error("fail"), "", "");
      },
    );

    await expect(scanRPackages("/project", "R")).rejects.toThrow();
    expect(mockUnlink).toHaveBeenCalledOnce();
  });

  test("rejects project path with double-quote character", async () => {
    await expect(scanRPackages('/project/with"quote', "R")).rejects.toThrow(
      "Project path contains invalid characters",
    );
  });
});
