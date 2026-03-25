// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  readPyProjectDependencies,
  readUvLockDependencies,
  generateRequirements,
} from "./pythonDependencySources";

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

function clearFiles() {
  for (const key of Object.keys(mockFiles)) {
    delete mockFiles[key];
  }
}

describe("readPyProjectDependencies", () => {
  beforeEach(clearFiles);

  test("returns null when pyproject.toml doesn't exist", async () => {
    const result = await readPyProjectDependencies("/project");
    expect(result).toBeNull();
  });

  test("returns null when no [project] section", async () => {
    setFile("/project", "pyproject.toml", "[tool.ruff]\nline-length = 88\n");
    const result = await readPyProjectDependencies("/project");
    expect(result).toBeNull();
  });

  test("returns null when no dependencies key", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      '[project]\nname = "myproject"\nversion = "1.0"\n',
    );
    const result = await readPyProjectDependencies("/project");
    expect(result).toBeNull();
  });

  test("reads direct dependencies", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      `[project]
name = "myproject"
dependencies = [
  "requests>=2.20",
  "numpy>=1.21",
  "pandas",
]
`,
    );
    const result = await readPyProjectDependencies("/project");
    expect(result).toEqual(["requests>=2.20", "numpy>=1.21", "pandas"]);
  });

  test("returns empty array when dependencies is empty", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      '[project]\nname = "myproject"\ndependencies = []\n',
    );
    const result = await readPyProjectDependencies("/project");
    expect(result).toEqual([]);
  });

  test("includes optional dependency groups when specified", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      `[project]
name = "myproject"
dependencies = ["requests"]

[project.optional-dependencies]
dev = ["pytest", "black"]
docs = ["sphinx"]
`,
    );
    const result = await readPyProjectDependencies("/project", ["dev"]);
    expect(result).toEqual(["requests", "pytest", "black"]);
  });

  test("includes multiple optional groups", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      `[project]
name = "myproject"
dependencies = ["requests"]

[project.optional-dependencies]
dev = ["pytest"]
docs = ["sphinx"]
`,
    );
    const result = await readPyProjectDependencies("/project", ["dev", "docs"]);
    expect(result).toEqual(["requests", "pytest", "sphinx"]);
  });

  test("ignores non-existent optional groups", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      `[project]
name = "myproject"
dependencies = ["requests"]

[project.optional-dependencies]
dev = ["pytest"]
`,
    );
    const result = await readPyProjectDependencies("/project", ["nonexistent"]);
    expect(result).toEqual(["requests"]);
  });

  test("returns null on invalid TOML", async () => {
    setFile("/project", "pyproject.toml", "this is not valid toml {{{}}}");
    const result = await readPyProjectDependencies("/project");
    expect(result).toBeNull();
  });
});

describe("readUvLockDependencies", () => {
  beforeEach(clearFiles);

  test("returns null when uv.lock doesn't exist", async () => {
    const result = await readUvLockDependencies("/project");
    expect(result).toBeNull();
  });

  test("reads packages excluding root editable project", async () => {
    setFile(
      "/project",
      "uv.lock",
      `version = 1
requires-python = ">=3.12"

[[package]]
name = "my-project"
version = "0.1.0"
source = { editable = "." }
dependencies = [
  { name = "requests" },
]

[[package]]
name = "requests"
version = "2.31.0"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "urllib3"
version = "2.1.0"
source = { registry = "https://pypi.org/simple" }
`,
    );
    const result = await readUvLockDependencies("/project");
    expect(result).toEqual(["requests==2.31.0", "urllib3==2.1.0"]);
  });

  test("excludes virtual source packages", async () => {
    setFile(
      "/project",
      "uv.lock",
      `version = 1

[[package]]
name = "my-project"
version = "0.1.0"
source = { virtual = "." }

[[package]]
name = "flask"
version = "3.0.2"
source = { registry = "https://pypi.org/simple" }
`,
    );
    const result = await readUvLockDependencies("/project");
    expect(result).toEqual(["flask==3.0.2"]);
  });

  test("skips packages without version", async () => {
    setFile(
      "/project",
      "uv.lock",
      `version = 1

[[package]]
name = "mystery"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "flask"
version = "3.0.2"
source = { registry = "https://pypi.org/simple" }
`,
    );
    const result = await readUvLockDependencies("/project");
    expect(result).toEqual(["flask==3.0.2"]);
  });

  test("returns null when no packages found", async () => {
    setFile("/project", "uv.lock", "version = 1\n");
    const result = await readUvLockDependencies("/project");
    expect(result).toBeNull();
  });

  test("returns null when only root project exists", async () => {
    setFile(
      "/project",
      "uv.lock",
      `version = 1

[[package]]
name = "my-project"
version = "0.1.0"
source = { editable = "." }
`,
    );
    const result = await readUvLockDependencies("/project");
    expect(result).toBeNull();
  });

  test("returns null on invalid TOML", async () => {
    setFile("/project", "uv.lock", "not valid toml {{{");
    const result = await readUvLockDependencies("/project");
    expect(result).toBeNull();
  });
});

describe("generateRequirements", () => {
  beforeEach(clearFiles);

  test("returns null when neither file exists", async () => {
    const result = await generateRequirements("/project");
    expect(result).toBeNull();
  });

  test("prefers uv.lock over pyproject.toml", async () => {
    setFile(
      "/project",
      "uv.lock",
      `version = 1

[[package]]
name = "flask"
version = "3.0.2"
source = { registry = "https://pypi.org/simple" }
`,
    );
    setFile(
      "/project",
      "pyproject.toml",
      `[project]
name = "myproject"
dependencies = ["flask>=3.0"]
`,
    );
    const result = await generateRequirements("/project");
    // Should use uv.lock (pinned version), not pyproject.toml
    expect(result).toEqual(["flask==3.0.2"]);
  });

  test("falls back to pyproject.toml when no uv.lock", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      `[project]
name = "myproject"
dependencies = ["requests>=2.20", "numpy"]
`,
    );
    const result = await generateRequirements("/project");
    expect(result).toEqual(["requests>=2.20", "numpy"]);
  });

  test("passes optional groups to pyproject.toml fallback", async () => {
    setFile(
      "/project",
      "pyproject.toml",
      `[project]
name = "myproject"
dependencies = ["requests"]

[project.optional-dependencies]
dev = ["pytest"]
`,
    );
    const result = await generateRequirements("/project", ["dev"]);
    expect(result).toEqual(["requests", "pytest"]);
  });

  test("ignores optional groups when using uv.lock", async () => {
    setFile(
      "/project",
      "uv.lock",
      `version = 1

[[package]]
name = "flask"
version = "3.0.2"
source = { registry = "https://pypi.org/simple" }
`,
    );
    // Even with optional groups specified, uv.lock returns its full set
    const result = await generateRequirements("/project", ["dev"]);
    expect(result).toEqual(["flask==3.0.2"]);
  });
});
