// Copyright (C) 2026 by Posit Software, PBC.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readPythonRequirements, resolveRPackages } from "./dependencies";

const mockFiles: Record<string, string> = {};

vi.mock("../interpreters/fsUtils", () => ({
  readFileText: vi.fn((filePath: string) => {
    const content = mockFiles[filePath];
    return Promise.resolve(content ?? null);
  }),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

const mockReadFile = vi.mocked(readFile);

function setFile(dir: string, filename: string, content: string) {
  mockFiles[path.join(dir, filename)] = content;
}

function clearFiles() {
  for (const key of Object.keys(mockFiles)) {
    delete mockFiles[key];
  }
}

const projectDir = "/project";

describe("readPythonRequirements", () => {
  beforeEach(clearFiles);

  test("returns undefined when no python config", async () => {
    const result = await readPythonRequirements(projectDir, undefined);
    expect(result).toBeUndefined();
  });

  test("reads default requirements.txt", async () => {
    setFile(projectDir, "requirements.txt", "numpy==1.22.0\npandas>=1.3.0\n");
    const result = await readPythonRequirements(projectDir, {
      packageFile: "",
    });
    expect(result).toEqual(["numpy==1.22.0", "pandas>=1.3.0"]);
  });

  test("reads configured package file", async () => {
    setFile(projectDir, "custom-requirements.txt", "tensorflow==2.9.0\n");
    const result = await readPythonRequirements(projectDir, {
      packageFile: "custom-requirements.txt",
    });
    expect(result).toEqual(["tensorflow==2.9.0"]);
  });

  test("filters comments and blank lines", async () => {
    setFile(
      projectDir,
      "requirements.txt",
      "# Comment line\nnumpy==1.22.0\n\n# Another comment\nflask==2.0.1\n",
    );
    const result = await readPythonRequirements(projectDir, {
      packageFile: "requirements.txt",
    });
    expect(result).toEqual(["numpy==1.22.0", "flask==2.0.1"]);
  });

  test("throws when requirements file does not exist", async () => {
    await expect(
      readPythonRequirements(projectDir, { packageFile: "requirements.txt" }),
    ).rejects.toThrow("Requirements file not found");
  });

  test("falls back to requirements.txt when packageFile is empty", async () => {
    setFile(projectDir, "requirements.txt", "flask\n");
    const result = await readPythonRequirements(projectDir, {
      packageFile: "",
    });
    expect(result).toEqual(["flask"]);
  });
});

// ---- resolveRPackages ----

const MINIMAL_LOCKFILE = JSON.stringify({
  R: {
    Version: "4.3.3",
    Repositories: [{ Name: "CRAN", URL: "https://cloud.r-project.org" }],
  },
  Packages: {
    rlang: {
      Package: "rlang",
      Version: "1.1.1",
      Source: "Repository",
      Repository: "CRAN",
      Hash: "a85c767b55f0bf9b7ad16c6d7baee5bb",
      Requirements: ["R"],
    },
  },
});

describe("resolveRPackages", () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  test("returns undefined when no R config", async () => {
    const result = await resolveRPackages(projectDir, undefined);
    expect(result).toBeUndefined();
  });

  test("reads default renv.lock and returns manifest packages", async () => {
    mockReadFile.mockResolvedValueOnce(MINIMAL_LOCKFILE as never);

    const result = await resolveRPackages(projectDir, { packageFile: "" });

    expect(mockReadFile).toHaveBeenCalledWith(
      path.join(projectDir, "renv.lock"),
      "utf-8",
    );
    expect(result).toBeDefined();
    const rlang = result!.packages["rlang"];
    expect(rlang).toBeDefined();
    expect(rlang!.Source).toBe("CRAN");
    expect(result!.lockfilePath).toBe(path.join(projectDir, "renv.lock"));
    expect(result!.lockfile.R.Version).toBe("4.3.3");
  });

  test("reads configured package file", async () => {
    mockReadFile.mockResolvedValueOnce(MINIMAL_LOCKFILE as never);

    const result = await resolveRPackages(projectDir, {
      packageFile: "custom/renv.lock",
    });

    expect(mockReadFile).toHaveBeenCalledWith(
      path.join(projectDir, "custom/renv.lock"),
      "utf-8",
    );
    expect(result).toBeDefined();
    expect(result!.packages["rlang"]).toBeDefined();
  });

  test("throws on lockfile without Repositories", async () => {
    const badLockfile = JSON.stringify({
      R: { Version: "4.3.3", Repositories: [] },
      Packages: {},
    });
    mockReadFile.mockResolvedValueOnce(badLockfile as never);

    await expect(
      resolveRPackages(projectDir, { packageFile: "" }),
    ).rejects.toThrow("missing Repositories section");
  });

  test("throws on invalid JSON", async () => {
    mockReadFile.mockResolvedValueOnce("not json" as never);

    await expect(
      resolveRPackages(projectDir, { packageFile: "" }),
    ).rejects.toThrow();
  });

  test("throws when lockfile does not exist", async () => {
    mockReadFile.mockRejectedValueOnce(
      new Error("ENOENT: no such file or directory"),
    );

    await expect(
      resolveRPackages(projectDir, { packageFile: "" }),
    ).rejects.toThrow("ENOENT");
  });
});
