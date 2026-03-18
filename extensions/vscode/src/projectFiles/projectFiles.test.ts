// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { getConfigurationFiles } from "./projectFiles";

describe("getConfigurationFiles", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "projectFiles-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeConfig(name: string, content: string): Promise<void> {
    const configDir = path.join(tmpDir, ".posit", "publish");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, `${name}.toml`), content);
  }

  test("includes files matching config patterns and excludes standard exclusions", async () => {
    await writeConfig(
      "myconfig",
      [
        '"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"',
        'type = "html"',
        'entrypoint = "index.html"',
        "files = [",
        '  "*.html",',
        "]",
      ].join("\n"),
    );

    await fs.writeFile(path.join(tmpDir, "index.html"), "<html></html>");
    await fs.writeFile(path.join(tmpDir, "page.html"), "<html></html>");
    await fs.writeFile(path.join(tmpDir, "data.csv"), "a,b,c");

    // Create a .git directory that should be excluded by standard exclusions
    await fs.mkdir(path.join(tmpDir, ".git"));
    await fs.writeFile(path.join(tmpDir, ".git", "config"), "");

    const tree = await getConfigurationFiles(tmpDir, "myconfig");

    expect(tree.isDir).toBe(true);
    expect(tree.id).toBe(".");

    const indexFile = tree.files.find((f) => f.base === "index.html");
    expect(indexFile).toBeDefined();
    expect(indexFile!.reason).not.toBeNull();
    expect(indexFile!.reason!.exclude).toBe(false);

    const pageFile = tree.files.find((f) => f.base === "page.html");
    expect(pageFile).toBeDefined();
    expect(pageFile!.reason).not.toBeNull();
    expect(pageFile!.reason!.exclude).toBe(false);

    // data.csv is in the tree but has no inclusion pattern match
    const csvFile = tree.files.find((f) => f.base === "data.csv");
    expect(csvFile).toBeDefined();
    expect(csvFile!.reason).toBeNull();

    // .git directory should have an exclusion reason from standard exclusions
    const gitDir = tree.files.find((f) => f.base === ".git");
    if (gitDir) {
      expect(gitDir.reason).not.toBeNull();
      expect(gitDir.reason!.exclude).toBe(true);
    }
  });

  test("works with empty files list in config", async () => {
    await writeConfig(
      "minimal",
      [
        '"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"',
        'type = "html"',
        'entrypoint = "index.html"',
      ].join("\n"),
    );

    await fs.writeFile(path.join(tmpDir, "index.html"), "<html></html>");

    const tree = await getConfigurationFiles(tmpDir, "minimal");

    expect(tree.isDir).toBe(true);
    // index.html should be in the tree with no inclusion reason (no file patterns)
    const indexFile = tree.files.find((f) => f.base === "index.html");
    expect(indexFile).toBeDefined();
    expect(indexFile!.reason).toBeNull();
  });

  test("respects both user patterns and standard exclusions together", async () => {
    await writeConfig(
      "mixed",
      [
        '"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"',
        'type = "html"',
        'entrypoint = "index.html"',
        "files = [",
        '  "*.html",',
        '  "!secret.html",',
        "]",
      ].join("\n"),
    );

    await fs.writeFile(path.join(tmpDir, "index.html"), "<html></html>");
    await fs.writeFile(path.join(tmpDir, "secret.html"), "<secret/>");

    const tree = await getConfigurationFiles(tmpDir, "mixed");

    // index.html should be included
    const indexFile = tree.files.find((f) => f.base === "index.html");
    expect(indexFile).toBeDefined();
    expect(indexFile!.reason).not.toBeNull();
    expect(indexFile!.reason!.exclude).toBe(false);

    // secret.html should be excluded by the user's !secret.html pattern
    const secretFile = tree.files.find((f) => f.base === "secret.html");
    expect(secretFile).toBeDefined();
    expect(secretFile!.reason).not.toBeNull();
    expect(secretFile!.reason!.exclude).toBe(true);
  });
});
