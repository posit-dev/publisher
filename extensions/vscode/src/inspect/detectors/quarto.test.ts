// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { QuartoDetector } from "./quarto";
import { ContentType } from "src/api/types/configurations";
import { logger } from "src/logging";

const { mockAccess, mockReadFile, mockReaddir, mockStat } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockReadFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock("src/logging");

vi.mock("fs/promises", () => ({
  access: mockAccess,
  readFile: mockReadFile,
  readdir: mockReaddir,
  stat: mockStat,
}));

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

vi.mock("util", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    promisify: () => mockExecFile,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeInspectOutput(overrides: Record<string, unknown> = {}): string {
  const base = {
    quarto: { version: "1.4.553" },
    engines: ["markdown"],
    files: {
      input: [],
      configResources: [],
    },
    formats: {
      html: {
        metadata: {},
        pandoc: {},
      },
    },
    ...overrides,
  };
  return JSON.stringify(base);
}

function setupGlobDir(files: string[]) {
  mockReaddir.mockResolvedValue(files);
  mockStat.mockImplementation((filePath: string) => {
    if (filePath.endsWith("_extensions")) {
      return Promise.resolve({ isFile: () => false, isDirectory: () => true });
    }
    return Promise.resolve({ isFile: () => true, isDirectory: () => false });
  });
}

describe("QuartoDetector", () => {
  const detector = new QuartoDetector();

  test("detects markdown doc (no engines needed)", async () => {
    setupGlobDir(["doc.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Just markdown\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/doc.qmd"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "My Document" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.entrypoint).toBe("doc.qmd");
    expect(configs[0]?.title).toBe("My Document");
    expect(configs[0]?.quarto).toEqual({
      version: "1.4.553",
      engines: ["markdown"],
    });
    expect(configs[0]?.python).toBeUndefined();
    expect(configs[0]?.r).toBeUndefined();
    // Should have an HTML alternative
    expect(configs[0]?.alternatives).toHaveLength(1);
    expect(configs[0]?.alternatives?.[0]?.type).toBe(ContentType.HTML);
  });

  test("detects Python project (jupyter engine)", async () => {
    setupGlobDir(["analysis.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const qmdContent = "```{python}\nimport pandas\n```\n";
    mockReadFile.mockResolvedValue(qmdContent);

    const inspectJson = makeInspectOutput({
      engines: ["jupyter"],
      files: { input: ["/project/analysis.qmd"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "Python Analysis" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "analysis.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("jupyter");
  });

  test("detects R project (knitr engine)", async () => {
    setupGlobDir(["report.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const qmdContent = "```{r}\nlibrary(ggplot2)\n```\n";
    mockReadFile.mockResolvedValue(qmdContent);

    const inspectJson = makeInspectOutput({
      engines: ["knitr"],
      files: { input: ["/project/report.qmd"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "R Report" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "report.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("knitr");
  });

  test("detects R+Python project (both engines)", async () => {
    setupGlobDir(["mixed.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const qmdContent =
      "```{r}\nlibrary(ggplot2)\n```\n\n```{python}\nimport pandas\n```\n";
    mockReadFile.mockResolvedValue(qmdContent);

    const inspectJson = makeInspectOutput({
      engines: ["jupyter", "knitr"],
      files: { input: ["/project/mixed.qmd"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "Mixed Report" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "mixed.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("jupyter");
    expect(configs[0]?.quarto?.engines).toContain("knitr");
  });

  test("detects Shiny project", async () => {
    setupGlobDir(["dashboard.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const qmdContent = "```{r}\nlibrary(shiny)\n```\n";
    mockReadFile.mockResolvedValue(qmdContent);

    const inspectJson = makeInspectOutput({
      engines: ["knitr"],
      files: { input: ["/project/dashboard.qmd"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "Dashboard", server: "shiny" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "dashboard.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_SHINY);
    // No alternatives for Shiny projects
    expect(configs[0]?.alternatives).toBeUndefined();
  });

  test("detects RevealJS shiny", async () => {
    setupGlobDir(["slides.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const qmdContent = "```{r}\nlibrary(shiny)\n```\n";
    mockReadFile.mockResolvedValue(qmdContent);

    const inspectJson = makeInspectOutput({
      engines: ["knitr"],
      files: { input: ["/project/slides.qmd"], configResources: [] },
      formats: {
        html: { metadata: {}, pandoc: {} },
        revealjs: {
          metadata: { title: "posit::conf(2024)", server: "shiny" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "slides.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_SHINY);
    expect(configs[0]?.title).toBe("posit::conf(2024)");
  });

  test("website project with output-dir generates static alternative", async () => {
    setupGlobDir(["index.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Home\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/index.qmd"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "My Site" },
          pandoc: {},
        },
      },
      project: {
        config: {
          project: {
            type: "website",
            "output-dir": "_site",
          },
        },
        files: {
          input: ["/project/index.qmd"],
          configResources: [],
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "index.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.alternatives).toHaveLength(1);
    expect(configs[0]?.alternatives?.[0]?.type).toBe(ContentType.HTML);
    expect(configs[0]?.alternatives?.[0]?.files).toContain("/_site");
  });

  test("notebook entrypoint needs Python", async () => {
    setupGlobDir(["report.ipynb"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const inspectJson = makeInspectOutput({
      engines: ["jupyter"],
      files: { input: ["/project/report.ipynb"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "Stock Report" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "report.ipynb");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("jupyter");
  });

  test("fallback when quarto binary missing: .qmd", async () => {
    setupGlobDir(["doc.qmd"]);
    // No _quarto.yml
    mockAccess.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_quarto.yml")) {
        return Promise.reject(new Error("ENOENT"));
      }
      return Promise.reject(new Error("ENOENT"));
    });
    mockReadFile.mockResolvedValue("# Content\n");

    // quarto inspect fails
    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.quarto?.version).toBe("1.7.34");
    expect(configs[0]?.files).toContain("/doc.qmd");
  });

  test("fallback when quarto binary missing: .ipynb", async () => {
    setupGlobDir(["notebook.ipynb"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    // quarto inspect fails
    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );

    const configs = await detector.inferType("/project", "notebook.ipynb");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.quarto).toEqual({
      version: "1.7.34",
      engines: ["jupyter"],
    });
  });

  test("fallback when quarto binary missing: .Rmd", async () => {
    setupGlobDir(["report.Rmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    // quarto inspect fails
    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );

    const configs = await detector.inferType("/project", "report.Rmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.quarto).toEqual({
      version: "1.7.34",
      engines: ["knitr"],
    });
  });

  test("skips non-quarto entrypoints", async () => {
    const configs = await detector.inferType("/project", "index.html");
    expect(configs).toHaveLength(0);
  });

  test("_quarto.yml as entrypoint", async () => {
    setupGlobDir([]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/index.qmd"], configResources: [] },
      config: {
        project: {
          title: "My Project",
          type: "website",
          "output-dir": "_site",
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "_quarto.yml");
    expect(configs).toHaveLength(1);
    // Entrypoint gets set to "." initially then may be resolved
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.title).toBe("My Project");
  });

  test("_quarto.yml entrypoint inspects the base directory, not the file", async () => {
    setupGlobDir([]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/index.qmd"], configResources: [] },
      formats: { html: { metadata: { title: "Project" }, pandoc: {} } },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    await detector.inferType("/project", "_quarto.yml");

    // quarto inspect should receive the base directory, not _quarto.yml
    expect(mockExecFile).toHaveBeenCalledWith(
      "quarto",
      ["inspect", "/project"],
      expect.objectContaining({ timeout: 30_000 }),
    );
  });

  test("entrypoint filter works", async () => {
    setupGlobDir(["a.qmd", "b.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Content\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/a.qmd"], configResources: [] },
      formats: {
        html: { metadata: { title: "A" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "a.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("a.qmd");
  });

  test("_extensions directory included when present", async () => {
    setupGlobDir(["doc.qmd"]);
    // _extensions dir exists
    mockStat.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_extensions")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      return Promise.resolve({ isFile: () => true, isDirectory: () => false });
    });
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Content\n");

    // quarto inspect fails, triggering fallback
    mockExecFile.mockRejectedValue(new Error("not found"));

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    // In fallback mode, the config should still be created
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
  });

  test("pre/post render scripts detect Python need", async () => {
    setupGlobDir(["doc.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Just markdown\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/doc.qmd"], configResources: [] },
      config: {
        project: {
          "pre-render": ["prepare.py"],
          "post-render": [],
        },
      },
      formats: {
        html: { metadata: { title: "Doc" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("jupyter");
  });

  test("pre/post render scripts detect R need", async () => {
    setupGlobDir(["doc.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Just markdown\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/doc.qmd"], configResources: [] },
      config: {
        project: {
          "pre-render": ["setup.R"],
          "post-render": [],
        },
      },
      formats: {
        html: { metadata: { title: "Doc" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("knitr");
  });

  test("static alternative includes companion *_files/ directories", async () => {
    setupGlobDir(["doc.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Content\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/doc.qmd"], configResources: [] },
      formats: {
        html: { metadata: { title: "Doc" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    // doc_files/ directory exists on disk
    mockStat.mockImplementation((filePath: string) => {
      if (filePath.endsWith("doc_files")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      if (filePath.endsWith("_extensions")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      return Promise.resolve({ isFile: () => true, isDirectory: () => false });
    });

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    const alt = configs[0]?.alternatives?.[0];
    expect(alt?.type).toBe(ContentType.HTML);
    expect(alt?.files).toContain("/doc.html");
    expect(alt?.files).toContain("/doc_files");
  });

  test("static alternative omits companion dir when it does not exist", async () => {
    setupGlobDir(["doc.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Content\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/doc.qmd"], configResources: [] },
      formats: {
        html: { metadata: { title: "Doc" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    const alt = configs[0]?.alternatives?.[0];
    expect(alt?.type).toBe(ContentType.HTML);
    expect(alt?.files).toContain("/doc.html");
    expect(alt?.files).not.toContain("/doc_files");
  });

  test("static alternative handles multiple files with some companion dirs", async () => {
    setupGlobDir(["a.qmd", "b.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Content\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: {
        input: ["/project/a.qmd", "/project/b.qmd"],
        configResources: [],
      },
      formats: {
        html: { metadata: { title: "Multi" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    // Only a_files/ exists, b_files/ does not
    mockStat.mockImplementation((filePath: string) => {
      if (filePath.endsWith("a_files")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      if (filePath.endsWith("_extensions")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      return Promise.resolve({ isFile: () => true, isDirectory: () => false });
    });

    const configs = await detector.inferType("/project", "a.qmd");
    expect(configs).toHaveLength(1);
    const alt = configs[0]?.alternatives?.[0];
    expect(alt?.type).toBe(ContentType.HTML);
    expect(alt?.files).toContain("/a.html");
    expect(alt?.files).toContain("/a_files");
    expect(alt?.files).toContain("/b.html");
    expect(alt?.files).not.toContain("/b_files");
  });

  test("companion dir ignored when path is a file not a directory", async () => {
    setupGlobDir(["doc.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Content\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/doc.qmd"], configResources: [] },
      formats: {
        html: { metadata: { title: "Doc" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    // doc_files exists but is a file, not a directory
    mockStat.mockImplementation((filePath: string) => {
      if (filePath.endsWith("doc_files")) {
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      if (filePath.endsWith("_extensions")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      return Promise.resolve({ isFile: () => true, isDirectory: () => false });
    });

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    const alt = configs[0]?.alternatives?.[0];
    expect(alt?.files).toContain("/doc.html");
    expect(alt?.files).not.toContain("/doc_files");
  });

  test("script entrypoints do not generate static alternative", async () => {
    setupGlobDir(["script.py"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# %%\nimport matplotlib\n");

    const inspectJson = makeInspectOutput({
      engines: ["jupyter"],
      files: { input: ["/project/script.py"], configResources: [] },
      formats: {
        html: {
          metadata: { title: "Penguin data" },
          pandoc: {},
        },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "script.py");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.alternatives).toBeUndefined();
  });

  // Case-insensitivity tests
  test("pre/post render scripts detect R need case-insensitively", async () => {
    setupGlobDir(["doc.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Just markdown\n");

    const inspectJson = makeInspectOutput({
      engines: ["markdown"],
      files: { input: ["/project/doc.qmd"], configResources: [] },
      config: {
        project: {
          "pre-render": ["setup.r"],
          "post-render": [],
        },
      },
      formats: {
        html: { metadata: { title: "Doc" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "doc.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("knitr");
  });

  test("script entrypoints skip static alternative case-insensitively", async () => {
    setupGlobDir(["script.r"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# R script\n");

    const inspectJson = makeInspectOutput({
      engines: ["knitr"],
      files: { input: ["/project/script.r"], configResources: [] },
      formats: {
        html: { metadata: { title: "R Script" }, pandoc: {} },
      },
    });
    mockExecFile.mockResolvedValue({ stdout: inspectJson });

    const configs = await detector.inferType("/project", "script.r");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.alternatives).toBeUndefined();
  });

  test("fallback detects R engine from .qmd file content", async () => {
    setupGlobDir(["report.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue(
      '---\ntitle: "Report"\n---\n\n```{r}\nsource("script.R")\n```\n',
    );

    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );

    const configs = await detector.inferType("/project", "report.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("knitr");
  });

  test("fallback detects Python engine from .qmd file content", async () => {
    setupGlobDir(["analysis.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue(
      '---\ntitle: "Analysis"\n---\n\n```{python}\nimport pandas\n```\n',
    );

    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );

    const configs = await detector.inferType("/project", "analysis.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("jupyter");
  });

  test("fallback detects both engines from .qmd file content", async () => {
    setupGlobDir(["mixed.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue(
      "```{r}\nlibrary(ggplot2)\n```\n\n```{python}\nimport pandas\n```\n",
    );

    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );

    const configs = await detector.inferType("/project", "mixed.qmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.quarto?.engines).toContain("knitr");
    expect(configs[0]?.quarto?.engines).toContain("jupyter");
  });

  test("fallback detects .rmd (lowercase) as Quarto content", async () => {
    setupGlobDir(["report.rmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );

    const configs = await detector.inferType("/project", "report.rmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(configs[0]?.r).toEqual({});
  });

  test("multi-document project produces separate configs per file", async () => {
    setupGlobDir(["report.qmd", "appendix.qmd"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReadFile.mockResolvedValue("# Content\n");

    mockExecFile.mockImplementation((_cmd: string, args: string[]) => {
      const target = args[1] ?? "";
      if (target.endsWith("report.qmd")) {
        return Promise.resolve({
          stdout: makeInspectOutput({
            engines: ["markdown"],
            files: {
              input: ["/project/report.qmd"],
              configResources: [],
            },
            formats: {
              html: {
                metadata: { title: "Main Report" },
                pandoc: {},
              },
            },
          }),
        });
      }
      if (target.endsWith("appendix.qmd")) {
        return Promise.resolve({
          stdout: makeInspectOutput({
            engines: ["markdown"],
            files: {
              input: ["/project/appendix.qmd"],
              configResources: [],
            },
            formats: {
              html: {
                metadata: { title: "Appendix" },
                pandoc: {},
              },
            },
          }),
        });
      }
      return Promise.reject(new Error("unexpected"));
    });

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(2);

    const report = configs.find((c) => c.entrypoint === "report.qmd");
    const appendix = configs.find((c) => c.entrypoint === "appendix.qmd");
    expect(report).toBeDefined();
    expect(report?.title).toBe("Main Report");
    expect(report?.type).toBe(ContentType.QUARTO_STATIC);
    expect(appendix).toBeDefined();
    expect(appendix?.title).toBe("Appendix");
    expect(appendix?.type).toBe(ContentType.QUARTO_STATIC);
  });

  test("website project discovers multiple entrypoints with full file inclusion", async () => {
    setupGlobDir(["index.qmd", "about.qmd"]);
    mockReadFile.mockResolvedValue("# Content\n");

    // _brand.yml exists; other special files do not
    mockAccess.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_brand.yml")) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("ENOENT"));
    });

    // Each file gets its own quarto inspect call, both return project-level
    // data (output-dir, full input list) plus per-file metadata.
    mockExecFile.mockImplementation((_cmd: string, args: string[]) => {
      const target = args[1] ?? "";
      if (target.endsWith("index.qmd")) {
        return Promise.resolve({
          stdout: makeInspectOutput({
            engines: ["markdown"],
            files: {
              input: ["/project/index.qmd", "/project/about.qmd"],
              configResources: ["/project/styles.css"],
            },
            config: {
              project: {
                type: "website",
                "output-dir": "_site",
                "pre-render": ["prepare.py"],
                "post-render": ["cleanup.R"],
              },
              website: {
                title: "My Website",
              },
            },
            formats: {
              html: {
                metadata: { title: "My Website" },
                pandoc: {},
              },
            },
          }),
        });
      }
      if (target.endsWith("about.qmd")) {
        return Promise.resolve({
          stdout: makeInspectOutput({
            engines: ["markdown"],
            files: {
              input: ["/project/index.qmd", "/project/about.qmd"],
              configResources: [],
            },
            config: {
              project: {
                type: "website",
                "output-dir": "_site",
                "pre-render": ["prepare.py"],
                "post-render": ["cleanup.R"],
              },
              website: {
                title: "My Website",
              },
            },
            formats: {
              html: {
                metadata: { title: "About" },
                pandoc: {},
              },
            },
          }),
        });
      }
      return Promise.reject(new Error("unexpected"));
    });

    // No entrypoint filter — discovers all .qmd files
    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(2);

    const index = configs.find((c) => c.entrypoint === "index.qmd");
    const about = configs.find((c) => c.entrypoint === "about.qmd");

    // Each config carries the full project file list
    expect(index).toBeDefined();
    expect(index?.title).toBe("My Website");
    expect(index?.type).toBe(ContentType.QUARTO_STATIC);
    expect(index?.files).toContain("/index.qmd");
    expect(index?.files).toContain("/about.qmd");
    expect(index?.files).toContain("/styles.css");
    expect(index?.files).toContain("/prepare.py");
    expect(index?.files).toContain("/cleanup.R");
    expect(index?.files).toContain("/_brand.yml");
    // Python from pre-render .py, R from post-render .R
    expect(index?.python).toEqual({});
    expect(index?.r).toEqual({});
    expect(index?.quarto?.engines).toContain("jupyter");
    expect(index?.quarto?.engines).toContain("knitr");
    // Static alternative points at _site output dir
    expect(index?.alternatives).toHaveLength(1);
    expect(index?.alternatives?.[0]?.type).toBe(ContentType.HTML);
    expect(index?.alternatives?.[0]?.files).toContain("/_site");

    expect(about).toBeDefined();
    expect(about?.title).toBe("About");
    expect(about?.type).toBe(ContentType.QUARTO_STATIC);
    expect(about?.files).toContain("/index.qmd");
    expect(about?.files).toContain("/about.qmd");
    expect(about?.alternatives).toHaveLength(1);
    expect(about?.alternatives?.[0]?.type).toBe(ContentType.HTML);
    expect(about?.alternatives?.[0]?.files).toContain("/_site");
  });

  test("accepts entrypoints with variant-case extensions", async () => {
    setupGlobDir(["doc.QMD"]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    mockExecFile.mockRejectedValue(
      new Error("executable file not found in $PATH"),
    );
    mockReadFile.mockResolvedValue("# Content\n");

    const configs = await detector.inferType("/project", "doc.QMD");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.QUARTO_STATIC);
  });

  describe("quarto inspect error logging (#4011)", () => {
    test("expected rejection logs at debug, not warn", async () => {
      setupGlobDir(["app.py"]);
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const err = Object.assign(
        new Error("Command failed: quarto inspect /project/app.py"),
        {
          stderr:
            "ERROR: /project/app.py is not a valid Quarto input document\n",
          code: 1,
        },
      );
      mockExecFile.mockRejectedValue(err);

      const configs = await detector.inferType("/project", "app.py");
      expect(configs).toHaveLength(0);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("quarto inspect failed"),
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("unexpected error logs at warn", async () => {
      setupGlobDir(["script.py"]);
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const err = Object.assign(new Error("Command failed: quarto inspect"), {
        stderr: "quarto: permission denied\n",
        code: 1,
      });
      mockExecFile.mockRejectedValue(err);

      const configs = await detector.inferType("/project", "script.py");
      expect(configs).toHaveLength(0);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("quarto inspect failed"),
      );
    });

    test("ENOENT (quarto not installed) logs at debug, not warn", async () => {
      setupGlobDir(["doc.qmd"]);
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      mockReadFile.mockResolvedValue("# Content\n");

      const err = Object.assign(new Error("spawn quarto ENOENT"), {
        code: "ENOENT",
      });
      mockExecFile.mockRejectedValue(err);

      const configs = await detector.inferType("/project", "doc.qmd");
      expect(configs).toHaveLength(1);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("quarto inspect failed"),
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test("timeout error logs at warn", async () => {
      setupGlobDir(["doc.qmd"]);
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      mockReadFile.mockResolvedValue("# Content\n");

      const err = Object.assign(new Error("quarto inspect timed out"), {
        killed: true,
        signal: "SIGTERM",
      });
      mockExecFile.mockRejectedValue(err);

      const configs = await detector.inferType("/project", "doc.qmd");
      expect(configs).toHaveLength(1);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("quarto inspect failed"),
      );
    });
  });
});
