// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPythonRequires } from "./pythonRequires";

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

function setFile(projectDir: string, filename: string, content: string) {
  mockFiles[path.join(projectDir, filename)] = content;
}

describe("getPythonRequires", () => {
  beforeEach(() => {
    // Clear all mock files
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
  });

  test("returns empty string when no files exist", async () => {
    const result = await getPythonRequires("/project");
    expect(result).toBe("");
  });

  describe(".python-version", () => {
    test("reads a bare version and adapts it", async () => {
      setFile("/project", ".python-version", "3.9.17");
      const result = await getPythonRequires("/project");
      expect(result).toBe("~=3.9.0");
    });

    test("reads comma-separated versions", async () => {
      setFile("/project", ".python-version", ">=3.8, <3.12");
      const result = await getPythonRequires("/project");
      expect(result).toBe(">=3.8,<3.12");
    });

    test("returns empty string for invalid version", async () => {
      setFile("/project", ".python-version", "3.10rc1");
      const result = await getPythonRequires("/project");
      expect(result).toBe("");
    });

    test("takes priority over pyproject.toml", async () => {
      setFile("/project", ".python-version", "3.11");
      setFile(
        "/project",
        "pyproject.toml",
        '[project]\nrequires-python = ">=3.8"',
      );
      const result = await getPythonRequires("/project");
      expect(result).toBe("~=3.11.0");
    });
  });

  describe("pyproject.toml", () => {
    test("reads requires-python from [project] section", async () => {
      setFile(
        "/project",
        "pyproject.toml",
        '[project]\nname = "myproject"\nrequires-python = ">=3.8"\n',
      );
      const result = await getPythonRequires("/project");
      expect(result).toBe(">=3.8");
    });

    test("returns empty string when requires-python is absent", async () => {
      setFile("/project", "pyproject.toml", '[project]\nname = "myproject"\n');
      const result = await getPythonRequires("/project");
      expect(result).toBe("");
    });

    test("takes priority over setup.cfg", async () => {
      setFile(
        "/project",
        "pyproject.toml",
        '[project]\nrequires-python = ">=3.9"',
      );
      setFile("/project", "setup.cfg", "[options]\npython_requires = >=3.7\n");
      const result = await getPythonRequires("/project");
      expect(result).toBe(">=3.9");
    });
  });

  describe("setup.cfg", () => {
    test("reads python_requires from [options] section", async () => {
      setFile("/project", "setup.cfg", "[options]\npython_requires = >=3.9\n");
      const result = await getPythonRequires("/project");
      expect(result).toBe(">=3.9");
    });

    test("ignores python_requires in wrong section", async () => {
      setFile("/project", "setup.cfg", "[metadata]\npython_requires = >=3.9\n");
      const result = await getPythonRequires("/project");
      expect(result).toBe("");
    });
  });
});
