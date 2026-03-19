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

async function collectedPaths(patterns: string[] = []): Promise<string[]> {
  const entries = await collectFiles(tmpDir, patterns);
  return entries
    .filter((e) => !e.isDirectory)
    .map((e) => e.relativePath)
    .sort();
}

// --- File collection tests ---

describe("collectFiles", () => {
  it("collects all files with default wildcard", async () => {
    makeFile("app.py");
    makeFile("requirements.txt");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py", "requirements.txt"]);
  });

  it("collects files in subdirectories", async () => {
    makeFile("app.py");
    makeFile("subdir/helper.py");

    const files = await collectedPaths();
    expect(files).toContain("subdir/helper.py");
  });

  it("includes directory entries", async () => {
    makeFile("subdir/file.py");

    const entries = await collectFiles(tmpDir, []);
    const dirs = entries.filter((e) => e.isDirectory);
    expect(dirs.some((d) => d.relativePath === "subdir")).toBe(true);
  });

  it("filters by specific file pattern", async () => {
    makeFile("app.py");
    makeFile("data.csv");
    makeFile("requirements.txt");

    const files = await collectedPaths(["*.py"]);
    expect(files).toEqual(["app.py"]);
  });

  it("supports multiple patterns", async () => {
    makeFile("app.py");
    makeFile("data.csv");
    makeFile("requirements.txt");

    const files = await collectedPaths(["*.py", "*.txt"]);
    expect(files).toEqual(["app.py", "requirements.txt"]);
  });

  it("supports exclusion patterns", async () => {
    makeFile("app.py");
    makeFile("test.py");
    makeFile("requirements.txt");

    const files = await collectedPaths(["*", "!test.py"]);
    expect(files).not.toContain("test.py");
    expect(files).toContain("app.py");
    expect(files).toContain("requirements.txt");
  });

  it("later patterns override earlier ones", async () => {
    makeFile("app.py");
    makeFile("debug.log");
    makeFile("important.log");

    // Exclude all logs, then re-include important.log
    const files = await collectedPaths(["*", "!*.log", "important.log"]);
    expect(files).toContain("app.py");
    expect(files).toContain("important.log");
    expect(files).not.toContain("debug.log");
  });

  it("exclusion after inclusion wins", async () => {
    makeFile("app.py");
    makeFile("test.py");

    // Include all .py, then exclude test.py
    const files = await collectedPaths(["*.py", "!test.py"]);
    expect(files).toEqual(["app.py"]);
  });

  it("later inclusion overrides earlier exclusion", async () => {
    makeFile("app.py");
    makeFile("test.py");

    // Exclude test.py, then re-include it
    const files = await collectedPaths(["*", "!test.py", "test.py"]);
    expect(files).toContain("test.py");
    expect(files).toContain("app.py");
  });

  it("excludes .git directory by default", async () => {
    makeFile("app.py");
    makeFile(".git/config");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes __pycache__ by default", async () => {
    makeFile("app.py");
    makeFile("__pycache__/module.pyc");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes node_modules by default", async () => {
    makeFile("app.py");
    makeFile("node_modules/package/index.js");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes .DS_Store by default", async () => {
    makeFile("app.py");
    makeFile(".DS_Store");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes manifest.json by default", async () => {
    makeFile("app.py");
    makeFile("manifest.json");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes .quarto/ by default", async () => {
    makeFile("doc.qmd");
    makeFile(".quarto/something");

    const files = await collectedPaths();
    expect(files).toEqual(["doc.qmd"]);
  });

  it("excludes *_cache/ directories by default", async () => {
    makeFile("doc.Rmd");
    makeFile("doc_cache/something");

    const files = await collectedPaths();
    expect(files).toEqual(["doc.Rmd"]);
  });

  // Standard exclusions are appended after user patterns, so they
  // always take precedence. Users cannot override them.
  it("standard exclusions cannot be overridden by user patterns", async () => {
    makeFile("app.py");
    makeFile(".git/config");
    makeFile("node_modules/pkg/index.js");
    makeFile("__pycache__/module.pyc");

    const files = await collectedPaths([
      "*",
      ".git/",
      "node_modules/",
      "__pycache__/",
    ]);
    expect(files).toEqual(["app.py"]);
  });

  it("standard exclusions cannot be overridden by specific file patterns", async () => {
    makeFile("app.py");
    makeFile(".git/config");
    makeFile("node_modules/pkg/index.js");

    // Try to include specific files inside excluded directories
    const files = await collectedPaths([
      "*",
      ".git/config",
      "node_modules/pkg/index.js",
    ]);
    expect(files).toEqual(["app.py"]);
  });

  it("bare wildcard pattern matches files at any depth", async () => {
    makeFile("app.py");
    makeFile("subdir/helper.py");
    makeFile("subdir/deep/util.py");
    makeFile("data.csv");

    const files = await collectedPaths(["*.py"]);
    expect(files).toEqual([
      "app.py",
      "subdir/deep/util.py",
      "subdir/helper.py",
    ]);
  });

  it("bare filename pattern matches at any depth", async () => {
    makeFile("app.py");
    makeFile("subdir/app.py");
    makeFile("subdir/deep/app.py");
    makeFile("other.py");

    const files = await collectedPaths(["app.py"]);
    expect(files).toEqual(["app.py", "subdir/app.py", "subdir/deep/app.py"]);
  });

  it("rooted pattern with wildcard matches only at that path", async () => {
    makeFile("subdir/helper.py");
    makeFile("subdir/deep/file.py");
    makeFile("other/helper.py");

    const files = await collectedPaths(["subdir/*.py"]);
    expect(files).toEqual(["subdir/helper.py"]);
  });

  it("rooted exact path only matches from the base", async () => {
    makeFile("data/app.py");
    makeFile("data/sub/app.py");

    const files = await collectedPaths(["data/app.py"]);
    expect(files).toEqual(["data/app.py"]);
  });

  it("leading slash roots the pattern to the base", async () => {
    makeFile("app.py");
    makeFile("subdir/app.py");

    const files = await collectedPaths(["/app.py"]);
    expect(files).toEqual(["app.py"]);
  });

  it("rooted exclusion only excludes at that path", async () => {
    makeFile("app.py");
    makeFile("test.py");
    makeFile("subdir/test.py");

    const files = await collectedPaths(["*", "!subdir/test.py"]);
    expect(files).toContain("app.py");
    expect(files).toContain("test.py");
    expect(files).not.toContain("subdir/test.py");
  });

  it("unrooted exclusion excludes at any depth", async () => {
    makeFile("app.py");
    makeFile("test.py");
    makeFile("subdir/test.py");
    makeFile("subdir/deep/test.py");

    const files = await collectedPaths(["*", "!test.py"]);
    expect(files).toEqual(["app.py"]);
  });

  it("supports ** glob patterns", async () => {
    makeFile("app.py");
    makeFile("subdir/helper.py");
    makeFile("subdir/deep/util.py");

    const files = await collectedPaths(["**/*.py"]);
    expect(files).toEqual([
      "app.py",
      "subdir/deep/util.py",
      "subdir/helper.py",
    ]);
  });

  it("handles empty directory gracefully", async () => {
    const files = await collectedPaths();
    expect(files).toEqual([]);
  });

  it("directory-only exclusion patterns don't exclude files", async () => {
    makeFile("logs/debug.txt");
    // A file literally named "logs" (not a directory)
    makeFile("subdir/logs");

    // Exclude "logs/" directories only
    const files = await collectedPaths(["*", "!logs/"]);
    // The file named "logs" inside subdir should still be included
    expect(files).toContain("subdir/logs");
    // Files inside the logs/ directory should be excluded
    expect(files).not.toContain("logs/debug.txt");
  });
});

// --- Python environment detection ---

describe("collectFiles with Python venvs", () => {
  it("excludes Python virtualenv directories with bin/python", async () => {
    makeFile("app.py");
    const venvDir = path.join(tmpDir, ".venv");
    fs.mkdirSync(path.join(venvDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(venvDir, "bin", "python"), "");
    makeFile(".venv/lib/site-packages/pkg/module.py");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("excludes Python virtualenv directories with bin/python3", async () => {
    makeFile("app.py");
    const venvDir = path.join(tmpDir, "env");
    fs.mkdirSync(path.join(venvDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(venvDir, "bin", "python3"), "");
    makeFile("env/lib/site-packages/pkg/module.py");

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });

  it("does not exclude directories without python binary", async () => {
    makeFile("src/lib/module.py");

    const files = await collectedPaths();
    expect(files).toContain("src/lib/module.py");
  });
});

// --- renv library exclusion ---

describe("collectFiles with renv dirs", () => {
  it("excludes renv/library", async () => {
    makeFile("app.R");
    makeFile("renv/library/R-4.3/pkg/DESCRIPTION");

    const files = await collectedPaths();
    expect(files).toEqual(["app.R"]);
  });

  it("excludes renv/sandbox", async () => {
    makeFile("app.R");
    makeFile("renv/sandbox/something");

    const files = await collectedPaths();
    expect(files).toEqual(["app.R"]);
  });

  it("excludes renv/staging", async () => {
    makeFile("app.R");
    makeFile("renv/staging/something");

    const files = await collectedPaths();
    expect(files).toEqual(["app.R"]);
  });

  it("does not exclude other renv subdirectories", async () => {
    makeFile("app.R");
    makeFile("renv/activate.R");

    const files = await collectedPaths();
    expect(files).toContain("renv/activate.R");
  });
});

// --- Symlink handling ---

describe("collectFiles with symlinks", () => {
  it("follows symlinks to files", async () => {
    makeFile("real_file.py");
    fs.symlinkSync(
      path.join(tmpDir, "real_file.py"),
      path.join(tmpDir, "link.py"),
    );

    const files = await collectedPaths();
    expect(files).toContain("link.py");
    expect(files).toContain("real_file.py");
  });

  it("follows symlinks to directories", async () => {
    makeFile("real_dir/file.py");
    fs.symlinkSync(
      path.join(tmpDir, "real_dir"),
      path.join(tmpDir, "linked_dir"),
    );

    const files = await collectedPaths();
    // The directory is visited via its first-encountered path.
    // The symlink pointing to the same real directory is skipped
    // to prevent cycles, so files appear under one path only.
    const hasFile =
      files.includes("real_dir/file.py") ||
      files.includes("linked_dir/file.py");
    expect(hasFile).toBe(true);
  });

  it("handles symlink cycles without infinite recursion", async () => {
    makeFile("app.py");
    // Create a symlink cycle: dir_a/link -> dir_b, dir_b/link -> dir_a
    fs.mkdirSync(path.join(tmpDir, "dir_a"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "dir_b"), { recursive: true });
    makeFile("dir_a/file_a.py");
    makeFile("dir_b/file_b.py");
    fs.symlinkSync(
      path.join(tmpDir, "dir_b"),
      path.join(tmpDir, "dir_a", "link_to_b"),
    );
    fs.symlinkSync(
      path.join(tmpDir, "dir_a"),
      path.join(tmpDir, "dir_b", "link_to_a"),
    );

    // Should complete without stack overflow
    const files = await collectedPaths();
    expect(files).toContain("app.py");
    expect(files).toContain("dir_a/file_a.py");
    // dir_b/file_b.py may appear under dir_b/ or dir_a/link_to_b/
    // depending on walk order, but should appear exactly once
    const fileBPaths = files.filter((f) => f.endsWith("file_b.py"));
    expect(fileBPaths).toHaveLength(1);
  });

  it("skips broken symlinks gracefully", async () => {
    makeFile("app.py");
    fs.symlinkSync(
      path.join(tmpDir, "nonexistent"),
      path.join(tmpDir, "broken_link"),
    );

    const files = await collectedPaths();
    expect(files).toEqual(["app.py"]);
  });
});
