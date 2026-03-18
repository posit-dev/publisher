// Copyright (C) 2025 by Posit Software, PBC.

import { exec, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { QuartoProjectHelper } from "./quartoProjectHelper";

// Mock runTerminalCommand since it depends on VSCode terminal APIs.
// We use a controllable mock that different test suites configure as needed.
const mockRunTerminalCommand = vi.fn();
vi.mock("./window", () => ({
  runTerminalCommand: (...args: unknown[]) => mockRunTerminalCommand(...args),
}));

// Do NOT mock fsUtils — these smoke tests use the real filesystem.

function isQuartoInstalled(): boolean {
  try {
    execSync("quarto --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const quartoAvailable = isQuartoInstalled();

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-smoke-"));
  vi.clearAllMocks();
  // Default: quarto --version check succeeds
  mockRunTerminalCommand.mockImplementation((cmd: string) => {
    if (cmd === "quarto --version") {
      return Promise.resolve(0);
    }
    return Promise.resolve(0);
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// --------------------------------------------------------------------------
// Real filesystem integration for isQuartoYmlPresent
// --------------------------------------------------------------------------
describe("QuartoProjectHelper - filesystem integration", () => {
  test("isQuartoYmlPresent returns true when _quarto.yml exists in projectDir", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "_quarto.yml"),
      "project:\n  type: website\n",
    );
    const helper = new QuartoProjectHelper("index.qmd", "index.html", tmpDir);
    expect(await helper.isQuartoYmlPresent()).toBe(true);
  });

  test("isQuartoYmlPresent returns false when _quarto.yml does not exist", async () => {
    const helper = new QuartoProjectHelper("index.qmd", "index.html", tmpDir);
    expect(await helper.isQuartoYmlPresent()).toBe(false);
  });

  test("isQuartoYmlPresent returns true when source includes _quarto.yml", async () => {
    // Does not need the file on disk — the source string itself contains _quarto.yml
    const helper = new QuartoProjectHelper("_quarto.yml", "index.html", tmpDir);
    expect(await helper.isQuartoYmlPresent()).toBe(true);
  });
});

// --------------------------------------------------------------------------
// Real Quarto rendering (skipped if Quarto is not installed)
// --------------------------------------------------------------------------
describe.skipIf(!quartoAvailable)(
  "QuartoProjectHelper - real Quarto render",
  () => {
    beforeEach(() => {
      // Replace mock with real command execution via child_process
      mockRunTerminalCommand.mockImplementation((cmd: string) => {
        return new Promise<number>((resolve, reject) => {
          exec(cmd, (error) => {
            if (error) {
              reject(error.code);
            } else {
              resolve(0);
            }
          });
        });
      });
    });

    test("renders a standalone .qmd document to HTML", async () => {
      const qmdContent = `---
title: "Smoke Test"
format: html
---

Hello world
`;
      fs.writeFileSync(path.join(tmpDir, "index.qmd"), qmdContent);

      const helper = new QuartoProjectHelper("index.qmd", "index.html", tmpDir);
      await helper.render();

      expect(fs.existsSync(path.join(tmpDir, "index.html"))).toBe(true);
    }, 30_000);

    test("renders a Quarto project to HTML", async () => {
      const quartoYml = `project:
  type: website
  output-dir: _site
`;
      const qmdContent = `---
title: "Smoke Test Project"
---

Hello project
`;
      fs.writeFileSync(path.join(tmpDir, "_quarto.yml"), quartoYml);
      fs.writeFileSync(path.join(tmpDir, "index.qmd"), qmdContent);

      const helper = new QuartoProjectHelper("index.qmd", "index.html", tmpDir);
      await helper.render();

      // For a website project, output goes to _site/
      expect(fs.existsSync(path.join(tmpDir, "_site", "index.html"))).toBe(
        true,
      );
    }, 30_000);
  },
);

// --------------------------------------------------------------------------
// Command construction with real filesystem
// --------------------------------------------------------------------------
describe("QuartoProjectHelper - command construction smoke test", () => {
  let capturedCommand: string | undefined;

  beforeEach(() => {
    capturedCommand = undefined;
    mockRunTerminalCommand.mockImplementation((cmd: string) => {
      if (cmd === "quarto --version") {
        return Promise.resolve(0);
      }
      capturedCommand = cmd;
      return Promise.resolve(0);
    });
  });

  test("constructs project render command when _quarto.yml exists on disk", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "_quarto.yml"),
      "project:\n  type: website\n",
    );

    const helper = new QuartoProjectHelper("index.qmd", "index.html", tmpDir);
    await helper.render();

    expect(capturedCommand).toBe(`quarto render "${tmpDir}" --to html`);
  });

  test("constructs document render command when _quarto.yml does not exist", async () => {
    const helper = new QuartoProjectHelper("index.qmd", "index.html", tmpDir);
    await helper.render();

    expect(capturedCommand).toBe(
      `quarto render "${path.join(tmpDir, "index.qmd")}" --to html`,
    );
  });

  test("constructs project render command when source is _quarto.yml", async () => {
    // Even without the file on disk, source="_quarto.yml" triggers project mode
    const helper = new QuartoProjectHelper("_quarto.yml", "index.html", tmpDir);
    await helper.render();

    expect(capturedCommand).toBe(`quarto render "${tmpDir}" --to html`);
  });
});
