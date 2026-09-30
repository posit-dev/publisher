// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { configureQuartoLookup, resolveQuartoBinary } from "./quartoBinary";

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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quarto bin "));
    originalPath = process.env.PATH;
    process.env.PATH = path.join(tmpDir, "empty-path-dir");
    configureQuartoLookup({});
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    configureQuartoLookup({});
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns bare 'quarto' when it is on PATH", async () => {
    const pathDir = path.join(tmpDir, "bin");
    makeExecutable(pathDir);
    process.env.PATH = pathDir;
    // Even with a bundled copy available, PATH wins.
    const appRoot = path.join(tmpDir, "app");
    makeExecutable(path.join(appRoot, "quarto", "bin"));
    configureQuartoLookup({ appRoot });

    expect(await resolveQuartoBinary()).toBe("quarto");
  });

  test("returns Positron's bundled quarto when not on PATH", async () => {
    const appRoot = path.join(tmpDir, "app");
    const bundled = makeExecutable(path.join(appRoot, "quarto", "bin"));
    configureQuartoLookup({ appRoot });

    expect(await resolveQuartoBinary()).toBe(bundled);
  });

  test("prefers the Quarto extension's choice over PATH and bundled", async () => {
    const pathDir = path.join(tmpDir, "bin");
    makeExecutable(pathDir);
    process.env.PATH = pathDir;
    const appRoot = path.join(tmpDir, "app");
    makeExecutable(path.join(appRoot, "quarto", "bin"));
    const configured = makeExecutable(path.join(tmpDir, "my quarto", "bin"));
    configureQuartoLookup({
      appRoot,
      quartoExtensionLookup: () =>
        Promise.resolve(path.join(tmpDir, "my quarto", "bin")),
    });

    expect(await resolveQuartoBinary()).toBe(configured);
  });

  test("accepts the Quarto extension returning the executable itself", async () => {
    const configured = makeExecutable(path.join(tmpDir, "my quarto", "bin"));
    configureQuartoLookup({
      quartoExtensionLookup: () => Promise.resolve(configured),
    });

    expect(await resolveQuartoBinary()).toBe(configured);
  });

  test("ignores the Quarto extension when it finds nothing or throws", async () => {
    const appRoot = path.join(tmpDir, "app");
    const bundled = makeExecutable(path.join(appRoot, "quarto", "bin"));

    configureQuartoLookup({
      appRoot,
      quartoExtensionLookup: () => Promise.resolve(undefined),
    });
    expect(await resolveQuartoBinary()).toBe(bundled);

    configureQuartoLookup({
      appRoot,
      quartoExtensionLookup: () => Promise.reject(new Error("boom")),
    });
    expect(await resolveQuartoBinary()).toBe(bundled);

    // A bin dir that doesn't actually contain quarto
    configureQuartoLookup({
      appRoot,
      quartoExtensionLookup: () => Promise.resolve(path.join(tmpDir, "nope")),
    });
    expect(await resolveQuartoBinary()).toBe(bundled);
  });

  test("falls back to bare 'quarto' when nothing is found", async () => {
    // e.g. VS Code, whose appRoot has no bundled quarto
    configureQuartoLookup({ appRoot: path.join(tmpDir, "app") });

    expect(await resolveQuartoBinary()).toBe("quarto");
  });
});
