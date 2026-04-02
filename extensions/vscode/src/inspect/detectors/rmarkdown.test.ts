// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { RMarkdownDetector } from "./rmarkdown";
import { ContentType } from "src/api/types/configurations";

const { mockAccess, mockReadFile, mockReaddir, mockStat } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockReadFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  access: mockAccess,
  readFile: mockReadFile,
  readdir: mockReaddir,
  stat: mockStat,
}));

afterEach(() => {
  vi.clearAllMocks();
});

const backticks = "```";

const basicRmdContent = `---
title: Special Report
---

# A Very Special Report

${backticks}{r, echo=TRUE}
library(foo)
${backticks}
`;

const pythonRmdContent = `---
title: Special Report
---

# A Very Special Report

${backticks}{python, echo=TRUE}
import foo
${backticks}
`;

const parameterizedRmdContent = `---
title: Special Report
params:
  truthiness: TRUE
  f: 1.2
---

# A Very Special Report

${backticks}{r, echo=TRUE}
library(foo)
${backticks}
`;

const shinyRmdRuntimeContent = `---
title: Interactive Report
runtime: shiny
---

# A Very Interactive Report

${backticks}{r, echo=TRUE}
library(foo)
${backticks}
`;

const shinyRmdServerContent = `---
title: Interactive Report
server: shiny
---

# A Very Interactive Report

${backticks}{r, echo=TRUE}
library(foo)
${backticks}
`;

const shinyRmdServerTypeContent = `---
title: Interactive Report
server:
    type: shiny
---

# A Very Interactive Report

${backticks}{r, echo=TRUE}
library(foo)
${backticks}
`;

const noMetaRmdContent = `
# Special Report

${backticks}{r, echo=TRUE}
library(foo)
${backticks}
`;

const rmdWithHorizontalRuleContent = `---
title: Test Report
author: Test Author
---

${backticks}{r}
mean(1:5)
${backticks}

Some text here.

---

More text after the horizontal rule.
`;

function setupGlobDir(files: string[]) {
  mockReaddir.mockResolvedValue(files);
  mockStat.mockResolvedValue({ isFile: () => true });
}

describe("RMarkdownDetector", () => {
  const detector = new RMarkdownDetector();

  test("basic Rmd with R code", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(basicRmdContent);
    // No site config files
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.title).toBe("Special Report");
    expect(configs[0]?.entrypoint).toBe("report.Rmd");
    expect(configs[0]?.files).toEqual(["/report.Rmd"]);
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.python).toBeUndefined();
  });

  test("Rmd with Python code", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(pythonRmdContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.title).toBe("Special Report");
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.r).toBeUndefined();
  });

  test("parameterized Rmd", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(parameterizedRmdContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.hasParameters).toBe(true);
    expect(configs[0]?.r).toEqual({});
  });

  test("Shiny Rmd via runtime: shiny", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(shinyRmdRuntimeContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD_SHINY);
    expect(configs[0]?.title).toBe("Interactive Report");
    expect(configs[0]?.r).toEqual({});
  });

  test("Shiny Rmd via server: shiny", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(shinyRmdServerContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD_SHINY);
    expect(configs[0]?.title).toBe("Interactive Report");
  });

  test("Shiny Rmd via server.type: shiny", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(shinyRmdServerTypeContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD_SHINY);
    expect(configs[0]?.title).toBe("Interactive Report");
  });

  test("no metadata still valid", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(noMetaRmdContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.title).toBeUndefined();
    expect(configs[0]?.entrypoint).toBe("report.Rmd");
    expect(configs[0]?.files).toEqual(["/report.Rmd"]);
    expect(configs[0]?.r).toEqual({});
  });

  test("entrypoint filter works", async () => {
    setupGlobDir(["report.Rmd", "other.Rmd"]);
    mockReadFile.mockResolvedValue(basicRmdContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project", "report.Rmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("report.Rmd");
  });

  test("language detection scans all .Rmd files, not just entrypoint", async () => {
    setupGlobDir(["report.Rmd", "helper.Rmd"]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("report.Rmd")) {
        return Promise.resolve(basicRmdContent); // R only
      }
      if (filePath.endsWith("helper.Rmd")) {
        return Promise.resolve(pythonRmdContent); // Python only
      }
      return Promise.reject(new Error("ENOENT"));
    });
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project", "report.Rmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("report.Rmd");
    // R from entrypoint, Python from sibling — both detected
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.python).toEqual({});
  });

  test("skips non-.Rmd entrypoints", async () => {
    const configs = await detector.inferType("/project", "app.py");
    expect(configs).toHaveLength(0);
  });

  test("horizontal rule in body does not break YAML extraction", async () => {
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(rmdWithHorizontalRuleContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.title).toBe("Test Report");
    expect(configs[0]?.r).toEqual({});
  });

  test("site detection includes _site.yml in files", async () => {
    setupGlobDir(["index.Rmd"]);
    mockReadFile.mockResolvedValue(basicRmdContent);
    // _site.yml exists
    mockAccess.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_site.yml")) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project", "index.Rmd");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.files).toContain("/_site.yml");
    expect(configs[0]?.files).toContain("/index.Rmd");
  });

  test("truncated YAML front matter still produces config", async () => {
    const truncatedYaml = `---
title: Incomplete
`;
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(truncatedYaml);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    // No closing --- means no metadata extracted
    expect(configs[0]?.title).toBeUndefined();
  });

  test("YAML with syntax errors is handled gracefully", async () => {
    const badYaml = `---
title: [unclosed bracket
runtime: {invalid: yaml: here
---

# Content
`;
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(badYaml);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    // Invalid YAML means no metadata extracted
    expect(configs[0]?.title).toBeUndefined();
  });

  test("binary-like content named .Rmd is handled gracefully", async () => {
    const binaryContent = "\x00\x01\x02\x03\x04\x05";
    setupGlobDir(["report.Rmd"]);
    mockReadFile.mockResolvedValue(binaryContent);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.title).toBeUndefined();
  });

  test("site config as entrypoint", async () => {
    // When _site.yml is the entrypoint, look up index.Rmd for metadata
    setupGlobDir(["index.Rmd"]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_site.yml")) {
        // site config content (no YAML front matter format)
        return Promise.resolve("name: My Site\n");
      }
      if (filePath.endsWith("index.Rmd")) {
        return Promise.resolve(basicRmdContent);
      }
      return Promise.reject(new Error("ENOENT"));
    });
    mockAccess.mockImplementation((filePath: string) => {
      if (filePath.endsWith("_site.yml")) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project", "_site.yml");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.RMD);
    expect(configs[0]?.entrypoint).toBe("_site.yml");
    expect(configs[0]?.title).toBe("Special Report");
    expect(configs[0]?.files).toContain("/_site.yml");
    expect(configs[0]?.files).toContain("/index.Rmd");
    // Language detection scans all .Rmd files in the directory
    expect(configs[0]?.r).toEqual({});
    expect(configs[0]?.python).toBeUndefined();
  });
});
