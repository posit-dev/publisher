// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readPythonRequirements } from "./dependencies";

const mockFiles: Record<string, string> = {};

vi.mock("../interpreters/fsUtils", () => ({
  readFileText: vi.fn((filePath: string) => {
    const content = mockFiles[filePath];
    return Promise.resolve(content ?? null);
  }),
}));

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
