// Copyright (C) 2025 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPythonRequires } from "./pythonRequires";

const mockFiles: Record<string, string> = {};

vi.mock("vscode", () => {
  return {
    Uri: {
      file: (path: string) => ({ fsPath: path, path }),
      joinPath: (base: { path: string }, ...segments: string[]) => {
        const joined = [base.path, ...segments].join("/");
        return { fsPath: joined, path: joined };
      },
    },
    workspace: {
      fs: {
        readFile: vi.fn((uri: { path: string }) => {
          const content = mockFiles[uri.path];
          if (content === undefined) {
            throw new Error(`File not found: ${uri.path}`);
          }
          return new TextEncoder().encode(content);
        }),
      },
    },
  };
});

function setFile(projectDir: string, filename: string, content: string) {
  mockFiles[`${projectDir}/${filename}`] = content;
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
      setFile(
        "/project",
        "pyproject.toml",
        '[project]\nname = "myproject"\n',
      );
      const result = await getPythonRequires("/project");
      expect(result).toBe("");
    });

    test("takes priority over setup.cfg", async () => {
      setFile(
        "/project",
        "pyproject.toml",
        '[project]\nrequires-python = ">=3.9"',
      );
      setFile(
        "/project",
        "setup.cfg",
        "[options]\npython_requires = >=3.7\n",
      );
      const result = await getPythonRequires("/project");
      expect(result).toBe(">=3.9");
    });
  });

  describe("setup.cfg", () => {
    test("reads python_requires from [options] section", async () => {
      setFile(
        "/project",
        "setup.cfg",
        "[options]\npython_requires = >=3.9\n",
      );
      const result = await getPythonRequires("/project");
      expect(result).toBe(">=3.9");
    });

    test("ignores python_requires in wrong section", async () => {
      setFile(
        "/project",
        "setup.cfg",
        "[metadata]\npython_requires = >=3.9\n",
      );
      const result = await getPythonRequires("/project");
      expect(result).toBe("");
    });
  });
});
