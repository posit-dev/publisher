// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { normalizeConfig } from "./normalize";
import { ContentType } from "src/api/types/configurations";
import { PartialConfig } from "./types";

const { mockDetectPython, mockDetectR } = vi.hoisted(() => ({
  mockDetectPython: vi.fn().mockResolvedValue({
    config: {
      version: "3.11.0",
      packageFile: "requirements.txt",
      packageManager: "auto",
    },
    preferredPath: "python3",
  }),
  mockDetectR: vi.fn().mockResolvedValue({
    config: {
      version: "4.3.0",
      packageFile: "renv.lock",
      packageManager: "renv",
    },
    preferredPath: "R",
  }),
}));

vi.mock("src/interpreters/pythonInterpreter", () => ({
  detectPythonInterpreter: mockDetectPython,
}));

vi.mock("src/interpreters/rInterpreter", () => ({
  detectRInterpreter: mockDetectR,
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

  test("sets empty python placeholder and adds package file when python marker present", async () => {
    const cfg: PartialConfig = {
      type: ContentType.PYTHON_FLASK,
      entrypoint: "app.py",
      python: {},
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project", "python3");
    expect(result.python).toBeDefined();
    // Config should be an empty placeholder (version/packageFile/packageManager
    // are determined at publish time, not baked into the config file)
    expect(result.python?.version).toBe("");
    expect(result.python?.packageFile).toBe("");
    expect(result.python?.packageManager).toBe("");
    // But the package file should still be added to the files list
    expect(result.files).toContain("/requirements.txt");
  });

  test("sets empty R placeholder and adds package file when r marker present", async () => {
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
    // Config should be an empty placeholder (version/packageFile/packageManager
    // are determined at publish time, not baked into the config file)
    expect(result.r?.version).toBe("");
    expect(result.r?.packageFile).toBe("");
    expect(result.r?.packageManager).toBe("");
    // But the package file should still be added to the files list
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

  test("sets empty python config when python not found", async () => {
    mockDetectPython.mockResolvedValueOnce({
      config: { version: "", packageFile: "", packageManager: "" },
      preferredPath: "",
    });
    const cfg: PartialConfig = {
      type: ContentType.PYTHON_FLASK,
      entrypoint: "app.py",
      python: {},
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.python).toBeDefined();
    expect(result.python?.version).toBe("");
    expect(result.python?.packageFile).toBe("");
    expect(result.python?.packageManager).toBe("");
    // Should not add empty packageFile to files list
    expect(result.files).toEqual(["/app.py"]);
  });

  test("sets empty R config when R not found but explicitly needed", async () => {
    mockDetectR.mockResolvedValueOnce({
      config: { version: "", packageFile: "", packageManager: "" },
      preferredPath: "",
    });
    const cfg: PartialConfig = {
      type: ContentType.R_SHINY,
      entrypoint: "app.R",
      r: {},
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.r).toBeDefined();
    expect(result.r?.version).toBe("");
    expect(result.r?.packageFile).toBe("");
    expect(result.r?.packageManager).toBe("");
  });

  test("sets empty R placeholder when R inferred via renv.lock even if detection fails", async () => {
    // R is inferred via renv.lock (not explicitly set via cfg.r)
    mockDetectR.mockResolvedValueOnce({
      config: { version: "", packageFile: "", packageManager: "" },
      preferredPath: "",
    });
    const cfg: PartialConfig = {
      type: ContentType.UNKNOWN,
      entrypoint: "",
    };
    // renv.lock exists, which triggers R detection for non-HTML/non-Python types
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await normalizeConfig(cfg, "/project");
    // Always set empty R placeholder when needR is true
    expect(result.r).toBeDefined();
    expect(result.r?.version).toBe("");
  });

  test("triggers R detection via renv.lock for non-HTML non-Python types", async () => {
    const cfg: PartialConfig = {
      type: ContentType.UNKNOWN,
      entrypoint: "",
    };
    // renv.lock exists
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await normalizeConfig(cfg, "/project", undefined, "R");
    // R should be detected because renv.lock exists for UNKNOWN type
    // Config is an empty placeholder; version determined at publish time
    expect(result.r).toBeDefined();
    expect(result.r?.version).toBe("");
  });

  test("does not trigger renv.lock R detection for HTML type", async () => {
    const cfg: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "index.html",
    };
    // renv.lock exists, but HTML type should skip renv.lock check
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await normalizeConfig(cfg, "/project");
    expect(result.r).toBeUndefined();
  });

  test("does not trigger renv.lock R detection for Python types", async () => {
    const cfg: PartialConfig = {
      type: ContentType.PYTHON_FLASK,
      entrypoint: "app.py",
      python: {},
    };
    // renv.lock exists, but Python types skip renv.lock check
    // (they use rpy2 check instead)
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await normalizeConfig(cfg, "/project");
    // No rpy2 in requirements.txt (readFile fails), so no R
    expect(result.r).toBeUndefined();
  });

  test("passes alternatives through without normalization", async () => {
    const alternative: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "report.html",
      source: "report.qmd",
      title: "report",
      files: ["/report.html"],
    };
    const cfg: PartialConfig = {
      type: ContentType.QUARTO_STATIC,
      entrypoint: "report.qmd",
      quarto: { version: "1.4.0", engines: ["markdown"] },
      alternatives: [alternative],
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.alternatives).toBeDefined();
    expect(result.alternatives).toHaveLength(1);
    // Alternatives are passed through as-is
    expect(result.alternatives![0]).toBe(alternative);
  });

  test("returns no alternatives when none provided", async () => {
    const cfg: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "index.html",
    };
    setupDefaultMocks();

    const result = await normalizeConfig(cfg, "/project");
    expect(result.alternatives).toBeUndefined();
  });

  test("uses entrypoint parameter as fallback when cfg.entrypoint is empty", async () => {
    const cfg: PartialConfig = {
      type: ContentType.UNKNOWN,
      entrypoint: "",
    };
    setupDefaultMocks();

    const result = await normalizeConfig(
      cfg,
      "/project",
      undefined,
      undefined,
      "custom-entry.py",
    );
    expect(result.entrypoint).toBe("custom-entry.py");
  });
});
