// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectFiles } from "./collect";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundler-collect-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeFile(relativePath: string, content = "test"): void {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function collectedPaths(patterns: string[] = []): string[] {
  return collectFiles(tmpDir, patterns)
    .filter((e) => !e.isDirectory)
    .map((e) => e.relativePath)
    .sort();
}

// --- File collection tests ---

describe("collectFiles", () => {
  it("collects all files with default wildcard", () => {
    makeFile("app.py");
    makeFile("requirements.txt");

    const files = collectedPaths();
    expect(files).toEqual(["app.py", "requirements.txt"]);
  });

  it("collects files in subdirectories", () => {
    makeFile("app.py");
    makeFile("subdir/helper.py");

    const files = collectedPaths();
    expect(files).toContain("subdir/helper.py");
  });

  it("includes directory entries", () => {
    makeFile("subdir/file.py");

    const entries = collectFiles(tmpDir, []);
    const dirs = entries.filter((e) => e.isDirectory);
    expect(dirs.some((d) => d.relativePath === "subdir")).toBe(true);
  });

  it("filters by specific file pattern", () => {
    makeFile("app.py");
    makeFile("data.csv");
    makeFile("requirements.txt");

    const files = collectedPaths(["*.py"]);
    expect(files).toEqual(["app.py"]);
  });

  it("supports multiple patterns", () => {
    makeFile("app.py");
    makeFile("data.csv");
    makeFile("requirements.txt");

    const files = collectedPaths(["*.py", "*.txt"]);
    expect(files).toEqual(["app.py", "requirements.txt"]);
  });

  it("supports exclusion patterns", () => {
    makeFile("app.py");
    makeFile("test.py");
    makeFile("requirements.txt");

    const files = collectedPaths(["*", "!test.py"]);
    expect(files).not.toContain("test.py");
    expect(files).toContain("app.py");
    expect(files).toContain("requirements.txt");
  });

  it("later patterns override earlier ones", () => {
    makeFile("app.py");
    makeFile("debug.log");
    makeFile("important.log");

    // Exclude all logs, then re-include important.log
    const files = collectedPaths(["*", "!*.log", "important.log"]);
    expect(files).toContain("app.py");
    expect(files).toContain("important.log");
    expect(files).not.toContain("debug.log");
  });

  it("exclusion after inclusion wins", () => {
    makeFile("app.py");
    makeFile("test.py");

    // Include all .py, then exclude test.py
    const files = collectedPaths(["*.py", "!test.py"]);
    expect(files).toEqual(["app.py"]);
  });

  it("later inclusion overrides earlier exclusion", () => {
    makeFile("app.py");
    makeFile("test.py");

    // Exclude test.py, then re-include it
    const files = collectedPaths(["*", "!test.py", "test.py"]);
    expect(files).toContain("test.py");
    expect(files).toContain("app.py");
  });

  it("excludes .git directory by default", () => {
    makeFile("app.py");
    makeFile(".git/config");

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes __pycache__ by default", () => {
    makeFile("app.py");
    makeFile("__pycache__/module.pyc");

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes node_modules by default", () => {
    makeFile("app.py");
    makeFile("node_modules/package/index.js");

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes .DS_Store by default", () => {
    makeFile("app.py");
    makeFile(".DS_Store");

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes manifest.json by default", () => {
    makeFile("app.py");
    makeFile("manifest.json");

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes .quarto/ by default", () => {
    makeFile("doc.qmd");
    makeFile(".quarto/something");

    const files = collectedPaths();
    expect(files).toEqual(["doc.qmd"]);
  });

  it("excludes *_cache/ directories by default", () => {
    makeFile("doc.Rmd");
    makeFile("doc_cache/something");

    const files = collectedPaths();
    expect(files).toEqual(["doc.Rmd"]);
  });

  // Standard exclusions are appended after user patterns, so they
  // always take precedence. Users cannot override them.
  it("standard exclusions cannot be overridden by user patterns", () => {
    makeFile("app.py");
    makeFile(".git/config");
    makeFile("node_modules/pkg/index.js");
    makeFile("__pycache__/module.pyc");

    const files = collectedPaths([
      "*",
      ".git/",
      "node_modules/",
      "__pycache__/",
    ]);
    expect(files).toEqual(["app.py"]);
  });

  it("supports rooted patterns with /", () => {
    makeFile("data/app.py");
    makeFile("data/sub/app.py");

    // This should only match data/app.py, not data/sub/app.py
    const files = collectedPaths(["data/app.py"]);
    expect(files).toEqual(["data/app.py"]);
  });

  it("supports ** glob patterns", () => {
    makeFile("app.py");
    makeFile("subdir/helper.py");
    makeFile("subdir/deep/util.py");

    const files = collectedPaths(["**/*.py"]);
    expect(files).toEqual([
      "app.py",
      "subdir/deep/util.py",
      "subdir/helper.py",
    ]);
  });

  it("handles empty directory gracefully", () => {
    const files = collectedPaths();
    expect(files).toEqual([]);
  });

  it("directory-only exclusion patterns don't exclude files", () => {
    makeFile("logs/debug.txt");
    // A file literally named "logs" (not a directory)
    makeFile("subdir/logs");

    // Exclude "logs/" directories only
    const files = collectedPaths(["*", "!logs/"]);
    // The file named "logs" inside subdir should still be included
    expect(files).toContain("subdir/logs");
    // Files inside the logs/ directory should be excluded
    expect(files).not.toContain("logs/debug.txt");
  });
});

// --- Python environment detection ---

describe("collectFiles with Python venvs", () => {
  it("excludes Python virtualenv directories with bin/python", () => {
    makeFile("app.py");
    const venvDir = path.join(tmpDir, ".venv");
    fs.mkdirSync(path.join(venvDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(venvDir, "bin", "python"), "");
    makeFile(".venv/lib/site-packages/pkg/module.py");

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes Python virtualenv directories with bin/python3", () => {
    makeFile("app.py");
    const venvDir = path.join(tmpDir, "env");
    fs.mkdirSync(path.join(venvDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(venvDir, "bin", "python3"), "");
    makeFile("env/lib/site-packages/pkg/module.py");

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("does not exclude directories without python binary", () => {
    makeFile("src/lib/module.py");

    const files = collectedPaths();
    expect(files).toContain("src/lib/module.py");
  });
});

// --- renv library exclusion ---

describe("collectFiles with renv dirs", () => {
  it("excludes renv/library", () => {
    makeFile("app.R");
    makeFile("renv/library/R-4.3/pkg/DESCRIPTION");

    const files = collectedPaths();
    expect(files).toEqual(["app.R"]);
  });

  it("excludes renv/sandbox", () => {
    makeFile("app.R");
    makeFile("renv/sandbox/something");

    const files = collectedPaths();
    expect(files).toEqual(["app.R"]);
  });

  it("excludes renv/staging", () => {
    makeFile("app.R");
    makeFile("renv/staging/something");

    const files = collectedPaths();
    expect(files).toEqual(["app.R"]);
  });

  it("does not exclude other renv subdirectories", () => {
    makeFile("app.R");
    makeFile("renv/activate.R");

    const files = collectedPaths();
    expect(files).toContain("renv/activate.R");
  });
});

// --- Symlink handling ---

describe("collectFiles with symlinks", () => {
  it("follows symlinks to files", () => {
    makeFile("real_file.py");
    fs.symlinkSync(
      path.join(tmpDir, "real_file.py"),
      path.join(tmpDir, "link.py"),
    );

    const files = collectedPaths();
    expect(files).toContain("link.py");
    expect(files).toContain("real_file.py");
  });

  it("follows symlinks to directories", () => {
    makeFile("real_dir/file.py");
    fs.symlinkSync(
      path.join(tmpDir, "real_dir"),
      path.join(tmpDir, "linked_dir"),
    );

    const files = collectedPaths();
    expect(files).toContain("linked_dir/file.py");
    expect(files).toContain("real_dir/file.py");
  });

  it("skips broken symlinks gracefully", () => {
    makeFile("app.py");
    fs.symlinkSync(
      path.join(tmpDir, "nonexistent"),
      path.join(tmpDir, "broken_link"),
    );

    const files = collectedPaths();
    expect(files).toEqual(["app.py"]);
  });
});
