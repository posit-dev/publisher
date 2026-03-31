// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { normalizeConfig } from "./normalize";
import { ContentType } from "src/api/types/configurations";
import { PartialConfig } from "./types";

vi.mock("src/interpreters/pythonInterpreter", () => ({
  detectPythonInterpreter: vi.fn().mockResolvedValue({
    config: {
      version: "3.11.0",
      packageFile: "requirements.txt",
      packageManager: "auto",
    },
    preferredPath: "python3",
  }),
}));

vi.mock("src/interpreters/rInterpreter", () => ({
  detectRInterpreter: vi.fn().mockResolvedValue({
    config: {
      version: "4.3.0",
      packageFile: "renv.lock",
      packageManager: "renv",
    },
    preferredPath: "R",
  }),
}));

const { mockReadFile, mockAccess } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockAccess: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
  access: mockAccess,
}));

afterEach(() => {
  vi.clearAllMocks();
});

// Default: no files exist on disk
function setupDefaultMocks() {
  mockAccess.mockRejectedValue(new Error("ENOENT"));
  mockReadFile.mockRejectedValue(new Error("ENOENT"));
}

describe("normalizeConfig", () => {
  test("sets default title from directory basename", async () => {
    const cfg: PartialConfig = {
      type: ContentType.PYTHON_FLASK,
      entrypoint: "app.py",
      python: {},
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/path/to/myproject");
    expect(result.title).toBe("myproject");
  });

  test("preserves existing title", async () => {
    const cfg: PartialConfig = {
      type: ContentType.PYTHON_FLASK,
      entrypoint: "app.py",
      title: "My Custom Title",
      python: {},
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/path/to/myproject");
    expect(result.title).toBe("My Custom Title");
  });

  test("fills default files list from entrypoint", async () => {
    const cfg: PartialConfig = {
      type: ContentType.PYTHON_FLASK,
      entrypoint: "app.py",
      python: {},
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.files).toContain("/app.py");
  });

  test("preserves existing files list", async () => {
    const cfg: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "index.html",
      files: ["/index.html", "/_site"],
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.files).toContain("/index.html");
    expect(result.files).toContain("/_site");
  });

  test("fills python config when python marker present", async () => {
    const cfg: PartialConfig = {
      type: ContentType.PYTHON_FLASK,
      entrypoint: "app.py",
      python: {},
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project", "python3");
    expect(result.python).toBeDefined();
    expect(result.python?.version).toBe("3.11.0");
    expect(result.python?.packageFile).toBe("requirements.txt");
    expect(result.files).toContain("/requirements.txt");
  });

  test("fills R config when r marker present", async () => {
    const cfg: PartialConfig = {
      type: ContentType.R_SHINY,
      entrypoint: "app.R",
      r: {},
    };
    setupDefaultMocks();
    // renv.lock exists for this test
    mockAccess.mockResolvedValue(undefined);

    const result = await normalizeConfig(cfg, "/project", undefined, "R");
    expect(result.r).toBeDefined();
    expect(result.r?.version).toBe("4.3.0");
    expect(result.r?.packageFile).toBe("renv.lock");
    expect(result.files).toContain("/renv.lock");
  });

  test("falls back entrypoint to 'unknown'", async () => {
    const cfg: PartialConfig = {
      type: ContentType.UNKNOWN,
      entrypoint: "",
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.entrypoint).toBe("unknown");
  });

  test("adds comment block", async () => {
    const cfg: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "index.html",
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.comments).toBeDefined();
    expect(result.comments.length).toBeGreaterThan(0);
    expect(result.comments.join("\n")).toContain("Posit Publisher");
  });
});
