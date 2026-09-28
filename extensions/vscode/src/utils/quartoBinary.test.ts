// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveQuartoBinary, setQuartoAppRoot } from "./quartoBinary";

const exeName = process.platform === "win32" ? "quarto.exe" : "quarto";

function makeExecutable(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, exeName);
  fs.writeFileSync(file, "");
  fs.chmodSync(file, 0o755);
  return file;
}

describe("resolveQuartoBinary", () => {
  let tmpDir: string;
  let originalPath: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-bin-"));
    originalPath = process.env.PATH;
    process.env.PATH = path.join(tmpDir, "empty-path-dir");
    setQuartoAppRoot(undefined);
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    setQuartoAppRoot(undefined);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns bare 'quarto' when it is on PATH", async () => {
    const pathDir = path.join(tmpDir, "bin");
    makeExecutable(pathDir);
    process.env.PATH = pathDir;
    // Even with a bundled copy available, PATH wins.
    const appRoot = path.join(tmpDir, "app");
    makeExecutable(path.join(appRoot, "quarto", "bin"));
    setQuartoAppRoot(appRoot);

    expect(await resolveQuartoBinary()).toBe("quarto");
  });

  test("returns Positron's bundled quarto when not on PATH", async () => {
    const appRoot = path.join(tmpDir, "app");
    const bundled = makeExecutable(path.join(appRoot, "quarto", "bin"));
    setQuartoAppRoot(appRoot);

    expect(await resolveQuartoBinary()).toBe(bundled);
  });

  test("falls back to bare 'quarto' when nothing is found", async () => {
    // e.g. VS Code, whose appRoot has no bundled quarto
    setQuartoAppRoot(path.join(tmpDir, "app"));

    expect(await resolveQuartoBinary()).toBe("quarto");
  });
});
