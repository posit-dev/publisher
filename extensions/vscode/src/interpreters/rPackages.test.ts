// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getRPackages, readLockfile } from "./rPackages";

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
}));

function setFile(dir: string, filename: string, content: string) {
  mockFiles[path.join(dir, filename)] = content;
}

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
    const result = await readLockfile("/project/renv.lock");
    expect(result).toBeNull();
  });

  test("parses a lockfile and transforms keys to lowercase", async () => {
    setFile("/project", "renv.lock", sampleLockfile);
    const result = await readLockfile("/project/renv.lock");
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
    const result = await readLockfile("/project/renv.lock");
    expect(result).toEqual({
      r: { version: "4.2.0", repositories: [] },
      packages: {},
    });
  });

  test("throws on invalid JSON", async () => {
    setFile("/project", "renv.lock", "not valid json{");
    await expect(readLockfile("/project/renv.lock")).rejects.toThrow();
  });

  test("propagates filesystem errors from readFileText", async () => {
    mockErrors["/project/renv.lock"] = Object.assign(
      new Error("EACCES: permission denied"),
      { code: "EACCES" },
    );
    await expect(readLockfile("/project/renv.lock")).rejects.toThrow(
      "EACCES: permission denied",
    );
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
