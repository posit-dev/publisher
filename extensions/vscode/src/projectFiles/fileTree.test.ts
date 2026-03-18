// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { buildFileTree } from "./fileTree";
import { MatchList, STANDARD_EXCLUSIONS } from "./matcher";
import { ContentRecordFileType } from "../api/types/files";

describe("buildFileTree", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fileTree-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("builds tree for empty directory", async () => {
    const matchList = new MatchList(tmpDir, ["*"]);
    const tree = await buildFileTree(tmpDir, matchList);

    expect(tree.id).toBe(".");
    expect(tree.isDir).toBe(true);
    expect(tree.fileType).toBe(ContentRecordFileType.DIRECTORY);
    expect(tree.files).toEqual([]);
    expect(tree.fileCount).toBe(0);
    expect(tree.size).toBe(0);
    expect(tree.allIncluded).toBe(false);
    expect(tree.allExcluded).toBe(false);
  });

  test("includes files matching patterns", async () => {
    await fs.writeFile(path.join(tmpDir, "app.py"), "print('hello')");
    await fs.writeFile(path.join(tmpDir, "data.csv"), "a,b,c");

    const matchList = new MatchList(tmpDir, ["*.py"]);
    const tree = await buildFileTree(tmpDir, matchList);

    expect(tree.files.length).toBe(2);

    const pyFile = tree.files.find((f) => f.base === "app.py");
    expect(pyFile).toBeDefined();
    expect(pyFile!.isFile).toBe(true);
    expect(pyFile!.reason).not.toBeNull();
    expect(pyFile!.reason!.exclude).toBe(false);

    const csvFile = tree.files.find((f) => f.base === "data.csv");
    expect(csvFile).toBeDefined();
    expect(csvFile!.reason).toBeNull();
  });

  test("builds nested directory structure", async () => {
    const subDir = path.join(tmpDir, "src");
    await fs.mkdir(subDir);
    await fs.writeFile(path.join(subDir, "main.py"), "pass");

    const matchList = new MatchList(tmpDir, ["*"]);
    const tree = await buildFileTree(tmpDir, matchList);

    expect(tree.files.length).toBe(1);
    const srcDir = tree.files[0]!;
    expect(srcDir.isDir).toBe(true);
    expect(srcDir.base).toBe("src");
    expect(srcDir.files.length).toBe(1);
    expect(srcDir.files[0]!.base).toBe("main.py");
  });

  test("calculates directory sizes and file counts", async () => {
    await fs.writeFile(path.join(tmpDir, "a.txt"), "hello"); // 5 bytes
    await fs.writeFile(path.join(tmpDir, "b.txt"), "world!"); // 6 bytes

    const matchList = new MatchList(tmpDir, ["*"]);
    const tree = await buildFileTree(tmpDir, matchList);

    expect(tree.fileCount).toBe(2);
    expect(tree.size).toBe(11);
  });

  test("calculates allIncluded/allExcluded", async () => {
    await fs.writeFile(path.join(tmpDir, "app.py"), "pass");
    await fs.writeFile(path.join(tmpDir, "readme.txt"), "hello");

    // Only *.py is included
    const matchList = new MatchList(tmpDir, ["*.py"]);
    const tree = await buildFileTree(tmpDir, matchList);

    expect(tree.allIncluded).toBe(false);
    expect(tree.allExcluded).toBe(false);

    const pyFile = tree.files.find((f) => f.base === "app.py");
    expect(pyFile!.allIncluded).toBe(true);

    const txtFile = tree.files.find((f) => f.base === "readme.txt");
    expect(txtFile!.allExcluded).toBe(true);
  });

  test("skips Python environment directories", async () => {
    const venvDir = path.join(tmpDir, ".venv");
    await fs.mkdir(venvDir);
    await fs.mkdir(path.join(venvDir, "bin"), { recursive: true });
    await fs.writeFile(path.join(venvDir, "bin", "python"), "");
    await fs.writeFile(path.join(venvDir, "pyvenv.cfg"), "");

    await fs.writeFile(path.join(tmpDir, "app.py"), "pass");

    const matchList = new MatchList(tmpDir, ["*"]);
    const tree = await buildFileTree(tmpDir, matchList);

    // .venv should be skipped
    const venvNode = tree.files.find((f) => f.base === ".venv");
    expect(venvNode).toBeUndefined();

    // app.py should be present
    const appNode = tree.files.find((f) => f.base === "app.py");
    expect(appNode).toBeDefined();
  });

  test("skips renv library directories", async () => {
    const renvDir = path.join(tmpDir, "renv");
    await fs.mkdir(renvDir);
    await fs.mkdir(path.join(renvDir, "library"));
    await fs.writeFile(
      path.join(renvDir, "library", "something.R"),
      "library()",
    );

    await fs.writeFile(path.join(tmpDir, "app.R"), "shiny::runApp()");

    const matchList = new MatchList(tmpDir, ["*"]);
    const tree = await buildFileTree(tmpDir, matchList);

    // renv directory node should exist
    const renvNode = tree.files.find((f) => f.base === "renv");
    expect(renvNode).toBeDefined();

    // But library subdirectory should be skipped
    if (renvNode) {
      const libraryNode = renvNode.files.find((f) => f.base === "library");
      expect(libraryNode).toBeUndefined();
    }
  });

  test("uses forward slashes in id field", async () => {
    const subDir = path.join(tmpDir, "src", "lib");
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(path.join(subDir, "utils.py"), "pass");

    const matchList = new MatchList(tmpDir, ["*"]);
    const tree = await buildFileTree(tmpDir, matchList);

    const srcDir = tree.files.find((f) => f.base === "src");
    expect(srcDir!.id).toBe("src");

    const libDir = srcDir!.files.find((f) => f.base === "lib");
    expect(libDir!.id).toBe("src/lib");

    const utilsFile = libDir!.files.find((f) => f.base === "utils.py");
    expect(utilsFile!.id).toBe("src/lib/utils.py");
  });

  test("applies standard exclusions", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    await fs.writeFile(path.join(tmpDir, ".git", "config"), "");
    await fs.writeFile(path.join(tmpDir, "app.py"), "pass");

    const matchList = new MatchList(tmpDir, STANDARD_EXCLUSIONS);
    const tree = await buildFileTree(tmpDir, matchList);

    // .git directory should still appear in the tree but with exclude reason
    // (the walker includes all files in the tree, exclusions are marked via reason)
    const gitDir = tree.files.find((f) => f.base === ".git");

    // app.py should be present with no reason (no inclusion pattern)
    const appFile = tree.files.find((f) => f.base === "app.py");
    expect(appFile).toBeDefined();

    // If .git is in the tree, it should have an exclude reason
    if (gitDir) {
      expect(gitDir.reason).not.toBeNull();
      expect(gitDir.reason!.exclude).toBe(true);
    }
  });
});
