// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPythonPackages, readRequirementsFile } from "./pythonPackages";

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
});
