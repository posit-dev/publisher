// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PositronRSettings } from "../api/types/positron";
import {
  getRPackages,
  readLockfile,
  repoURLFromOptions,
  scanRPackages,
} from "./rPackages";

// --- Mocks for lockfile reading tests ---

const mockFiles: Record<string, string> = {};
const mockErrors: Record<string, Error> = {};

vi.mock("./fsUtils", () => ({
  readFileText: vi.fn((filePath: string) => {
    const error = mockErrors[filePath];
    if (error) {
      return Promise.reject(error);
    }
    const content = mockFiles[filePath];
    if (content === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve(content);
  }),
  fileExistsAt: vi.fn((...args: unknown[]) => mockFileExistsAt(...args)),
}));

function setFile(dir: string, filename: string, content: string) {
  mockFiles[path.join(dir, filename)] = content;
}

// --- Mocks for scan tests ---

const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

const mockWriteFile = vi.fn();
const mockUnlink = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

const mockFileExistsAt = vi.fn();

// --- Lockfile reading tests ---

const sampleLockfile = JSON.stringify({
  R: {
    Version: "4.3.0",
    Repositories: [{ Name: "CRAN", URL: "https://cran.rstudio.com" }],
  },
  Packages: {
    mypkg: {
      Package: "mypkg",
      Version: "1.2.3",
      Source: "Repository",
      Repository: "CRAN",
    },
    otherpkg: {
      Package: "otherpkg",
      Version: "0.5.0",
      Source: "Repository",
      Repository: "CRAN",
    },
  },
});

describe("readLockfile", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
    for (const key of Object.keys(mockErrors)) {
      delete mockErrors[key];
    }
  });

  test("returns null when file doesn't exist", async () => {
    const result = await readLockfile(path.join("/project", "renv.lock"));
    expect(result).toBeNull();
  });

  test("parses a lockfile and transforms keys to lowercase", async () => {
    setFile("/project", "renv.lock", sampleLockfile);
    const result = await readLockfile(path.join("/project", "renv.lock"));
    expect(result).toEqual({
      r: {
        version: "4.3.0",
        repositories: [{ name: "CRAN", url: "https://cran.rstudio.com" }],
      },
      packages: {
        mypkg: {
          package: "mypkg",
          version: "1.2.3",
          source: "Repository",
          repository: "CRAN",
        },
        otherpkg: {
          package: "otherpkg",
          version: "0.5.0",
          source: "Repository",
          repository: "CRAN",
        },
      },
    });
  });

  test("handles lockfile with empty packages", async () => {
    const lockfile = JSON.stringify({
      R: { Version: "4.2.0", Repositories: [] },
      Packages: {},
    });
    setFile("/project", "renv.lock", lockfile);
    const result = await readLockfile(path.join("/project", "renv.lock"));
    expect(result).toEqual({
      r: { version: "4.2.0", repositories: [] },
      packages: {},
    });
  });

  test("throws on invalid JSON", async () => {
    setFile("/project", "renv.lock", "not valid json{");
    await expect(
      readLockfile(path.join("/project", "renv.lock")),
    ).rejects.toThrow();
  });

  test("propagates filesystem errors from readFileText", async () => {
    mockErrors[path.join("/project", "renv.lock")] = Object.assign(
      new Error("EACCES: permission denied"),
      { code: "EACCES" },
    );
    await expect(
      readLockfile(path.join("/project", "renv.lock")),
    ).rejects.toThrow("EACCES: permission denied");
  });
});

describe("getRPackages", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
    for (const key of Object.keys(mockErrors)) {
      delete mockErrors[key];
    }
  });

  test("returns parsed lockfile response", async () => {
    setFile("/project", "renv.lock", sampleLockfile);
    const result = await getRPackages("/project", "renv.lock");
    expect(result.r.version).toBe("4.3.0");
    expect(Object.keys(result.packages)).toEqual(["mypkg", "otherpkg"]);
  });

  test("throws when lockfile doesn't exist", async () => {
    await expect(getRPackages("/project", "renv.lock")).rejects.toThrow(
      "Lockfile not found",
    );
  });

  test("uses the given package file name", async () => {
    setFile("/project", "custom.lock", sampleLockfile);
    const result = await getRPackages("/project", "custom.lock");
    expect(result.r.version).toBe("4.3.0");
  });

  test("propagates filesystem errors instead of showing 'not found'", async () => {
    mockErrors[path.join("/project", "renv.lock")] = Object.assign(
      new Error("EACCES: permission denied"),
      { code: "EACCES" },
    );
    await expect(getRPackages("/project", "renv.lock")).rejects.toThrow(
      "EACCES: permission denied",
    );
  });
});

// --- Repo URL tests ---

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

// --- Scan tests ---

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
    expect(args).toEqual(["--no-init-file", "-s", "-f", tmpPath]);
    expect(opts.cwd).toBe("/project");
    expect(opts.env.RENV_CONFIG_AUTOLOADER_ENABLED).toBe("FALSE");

    // Verify lockfile existence was checked
    expect(mockFileExistsAt).toHaveBeenCalledWith(
      path.join("/project", "renv.lock"),
    );

    // Verify temp file was cleaned up
    expect(mockUnlink).toHaveBeenCalledWith(tmpPath);
  });

  test("uses custom save name", async () => {
    setupExecFileSuccess();
    mockFileExistsAt.mockResolvedValue(true);

    await scanRPackages("/project", "R", "my_renv.lock");

    const [, script] = mockWriteFile.mock.calls[0]!;
    expect(script).toContain("my_renv.lock");
    expect(mockFileExistsAt).toHaveBeenCalledWith(
      path.join("/project", "my_renv.lock"),
    );
  });

  test("supports save name with subdirectory path", async () => {
    setupExecFileSuccess();
    mockFileExistsAt.mockResolvedValue(true);

    await scanRPackages("/project", "R", ".renv/profiles/staging/renv.lock");

    const [, script] = mockWriteFile.mock.calls[0]!;
    expect(script).toContain(".renv/profiles/staging/renv.lock");
    expect(mockFileExistsAt).toHaveBeenCalledWith(
      path.join("/project", ".renv/profiles/staging/renv.lock"),
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
