// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileAction } from "../api/types/files";
import { includeFile, excludeFile, updateFileList } from "./configFiles";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-files-test-"));
  fs.mkdirSync(path.join(tmpDir, ".posit", "publish"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(name: string, content: string): void {
  const configPath = path.join(tmpDir, ".posit", "publish", `${name}.toml`);
  fs.writeFileSync(configPath, content, "utf-8");
}

function readConfig(name: string): string {
  const configPath = path.join(tmpDir, ".posit", "publish", `${name}.toml`);
  return fs.readFileSync(configPath, "utf-8");
}

const baseToml = `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[python]
version = "3.11"
`;

const tomlWithFiles = `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
files = ["/data.csv", "!/secrets.env"]

[python]
version = "3.11"
`;

describe("includeFile", () => {
  it("adds a new path to files list", async () => {
    writeConfig("myapp", baseToml);

    await includeFile("myapp", "/newfile.txt", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain("/newfile.txt");
  });

  it("removes an exclusion pattern when including a previously excluded file", async () => {
    writeConfig("myapp", tomlWithFiles);

    await includeFile("myapp", "/secrets.env", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).not.toContain("!/secrets.env");
    // The original inclusion should still be there
    expect(content).toContain("/data.csv");
  });

  it("is idempotent when path is already included", async () => {
    writeConfig("myapp", tomlWithFiles);

    await includeFile("myapp", "/data.csv", ".", tmpDir);

    const content = readConfig("myapp");
    // Should not duplicate
    const matches = content.match(/\/data\.csv/g);
    expect(matches).toHaveLength(1);
  });

  it("throws ENOENT for missing config file", async () => {
    await expect(
      includeFile("nonexistent", "/file.txt", ".", tmpDir),
    ).rejects.toThrow(/ENOENT/);
  });

  it("preserves other config fields", async () => {
    writeConfig("myapp", baseToml);

    await includeFile("myapp", "/newfile.txt", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain('type = "python-dash"');
    expect(content).toContain('entrypoint = "app.py"');
  });
});

describe("excludeFile", () => {
  it("adds an exclusion pattern for a new path", async () => {
    writeConfig("myapp", baseToml);

    await excludeFile("myapp", "/unwanted.log", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain("!/unwanted.log");
  });

  it("removes an inclusion when excluding a previously included file", async () => {
    writeConfig("myapp", tomlWithFiles);

    await excludeFile("myapp", "/data.csv", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).not.toContain('"/data.csv"');
    // The exclusion pattern should still be there
    expect(content).toContain("!/secrets.env");
  });

  it("is idempotent when exclusion already exists", async () => {
    writeConfig("myapp", tomlWithFiles);

    await excludeFile("myapp", "/secrets.env", ".", tmpDir);

    const content = readConfig("myapp");
    // Should not duplicate the exclusion
    const matches = content.match(/!\/secrets\.env/g);
    expect(matches).toHaveLength(1);
  });

  it("throws ENOENT for missing config file", async () => {
    await expect(
      excludeFile("nonexistent", "/file.txt", ".", tmpDir),
    ).rejects.toThrow(/ENOENT/);
  });

  it("preserves other config fields", async () => {
    writeConfig("myapp", baseToml);

    await excludeFile("myapp", "/unwanted.log", ".", tmpDir);

    const content = readConfig("myapp");
    expect(content).toContain('type = "python-dash"');
    expect(content).toContain('entrypoint = "app.py"');
  });
});

describe("updateFileList", () => {
  it("dispatches to includeFile for INCLUDE action", async () => {
    writeConfig("myapp", baseToml);

    await updateFileList(
      "myapp",
      "/newfile.txt",
      FileAction.INCLUDE,
      ".",
      tmpDir,
    );

    const content = readConfig("myapp");
    expect(content).toContain("/newfile.txt");
    expect(content).not.toContain("!/newfile.txt");
  });

  it("dispatches to excludeFile for EXCLUDE action", async () => {
    writeConfig("myapp", baseToml);

    await updateFileList(
      "myapp",
      "/unwanted.log",
      FileAction.EXCLUDE,
      ".",
      tmpDir,
    );

    const content = readConfig("myapp");
    expect(content).toContain("!/unwanted.log");
  });

  it("throws for invalid action", async () => {
    writeConfig("myapp", baseToml);

    await expect(
      updateFileList(
        "myapp",
        "/file.txt",
        "invalid" as FileAction,
        ".",
        tmpDir,
      ),
    ).rejects.toThrow(/invalid file action/);
  });
});
