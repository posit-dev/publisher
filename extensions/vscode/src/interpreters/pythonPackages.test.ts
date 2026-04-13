// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPythonPackages, readRequirementsFile } from "./pythonPackages";
import { generateRequirements } from "./pythonDependencySources";

const mockFiles: Record<string, string> = {};

vi.mock("./fsUtils", () => ({
  readFileText: vi.fn((filePath: string) => {
    const content = mockFiles[filePath];
    if (content === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve(content);
  }),
}));

vi.mock("./pythonDependencySources", () => ({
  generateRequirements: vi.fn(() => Promise.resolve(null)),
}));

function setFile(dir: string, filename: string, content: string) {
  mockFiles[path.join(dir, filename)] = content;
}

describe("readRequirementsFile", () => {
  const reqFile = path.join("/project", "requirements.txt");

  beforeEach(() => {
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
  });

  test("returns null when file doesn't exist", async () => {
    const result = await readRequirementsFile(reqFile);
    expect(result).toBeNull();
  });

  test("reads packages from a requirements file", async () => {
    setFile("/project", "requirements.txt", "numpy\npandas\n");
    const result = await readRequirementsFile(reqFile);
    expect(result).toEqual(["numpy", "pandas"]);
  });

  test("filters out comments and blank lines", async () => {
    setFile(
      "/project",
      "requirements.txt",
      "# This is a comment\nnumpy\n\n# Another comment\npandas\n  \n  # indented comment\nscipy\n",
    );
    const result = await readRequirementsFile(reqFile);
    expect(result).toEqual(["numpy", "pandas", "scipy"]);
  });

  test("returns empty array for file with only comments and blanks", async () => {
    setFile("/project", "requirements.txt", "# comment\n\n  # another\n  \n");
    const result = await readRequirementsFile(reqFile);
    expect(result).toEqual([]);
  });

  test("handles file with no trailing newline", async () => {
    setFile("/project", "requirements.txt", "numpy\npandas");
    const result = await readRequirementsFile(reqFile);
    expect(result).toEqual(["numpy", "pandas"]);
  });
});

describe("getPythonPackages", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
    vi.clearAllMocks();
  });

  test("returns packages from a requirements file", async () => {
    setFile("/project", "requirements.txt", "numpy\npandas\n");
    const result = await getPythonPackages("/project", "requirements.txt");
    expect(result).toEqual(["numpy", "pandas"]);
  });

  test("throws when requirements file doesn't exist", async () => {
    await expect(
      getPythonPackages("/project", "requirements.txt"),
    ).rejects.toThrow("Requirements file not found");
  });

  test("uses the given package file name", async () => {
    setFile("/project", "requirements-dev.txt", "flask\n");
    const result = await getPythonPackages("/project", "requirements-dev.txt");
    expect(result).toEqual(["flask"]);
  });

  test("falls back to generated requirements when file missing", async () => {
    vi.mocked(generateRequirements).mockResolvedValueOnce([
      "flask==3.0.2",
      "urllib3==2.1.0",
    ]);
    const result = await getPythonPackages("/project", "requirements.txt");
    expect(result).toEqual(["flask==3.0.2", "urllib3==2.1.0"]);
  });

  test("throws when file missing and no lockfile source available", async () => {
    vi.mocked(generateRequirements).mockResolvedValueOnce(null);
    await expect(
      getPythonPackages("/project", "requirements.txt"),
    ).rejects.toThrow("Requirements file not found");
  });

  test("prefers requirements file over generated requirements", async () => {
    setFile("/project", "requirements.txt", "numpy\n");
    vi.mocked(generateRequirements).mockResolvedValueOnce(["flask==3.0.2"]);
    const result = await getPythonPackages("/project", "requirements.txt");
    expect(result).toEqual(["numpy"]);
    expect(generateRequirements).not.toHaveBeenCalled();
  });

  test("does not fall back for non-default package files", async () => {
    // If the user explicitly configured a different package file,
    // missing it should throw — not silently substitute generated deps.
    await expect(
      getPythonPackages("/project", "requirements-dev.txt"),
    ).rejects.toThrow("Requirements file not found");
    expect(generateRequirements).not.toHaveBeenCalled();
  });
});
