// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import {
  detectMarkdownLanguagesInContent,
  detectMarkdownLanguagesInDirectory,
} from "./markdownLanguages";

const { mockReadFile, mockReaddir, mockStat } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
  readdir: mockReaddir,
  stat: mockStat,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("detectMarkdownLanguagesInContent", () => {
  test("detects R code blocks", () => {
    const content = "# Title\n\n```{r}\nprint('hello')\n```\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(false);
  });

  test("detects Python code blocks", () => {
    const content = "# Title\n\n```{python}\nprint('hello')\n```\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(false);
    expect(result.needsPython).toBe(true);
  });

  test("detects both R and Python", () => {
    const content =
      "```{r}\nlibrary(ggplot2)\n```\n\n```{python}\nimport pandas\n```\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(true);
  });

  test("returns false for plain markdown", () => {
    const content = "# Title\n\nSome text\n\n```\ncode\n```\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(false);
    expect(result.needsPython).toBe(false);
  });

  test("detects R blocks with chunk options", () => {
    const content = "```{r, echo=FALSE}\nplot(1:10)\n```\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(true);
  });

  test("detects Python blocks with chunk options", () => {
    const content = "```{python, echo=FALSE}\nimport os\n```\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsPython).toBe(true);
  });

  test("detects R code blocks with tilde fencing", () => {
    const content = "# Title\n\n~~~{r}\nprint('hello')\n~~~\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(false);
  });

  test("detects Python code blocks with tilde fencing", () => {
    const content = "# Title\n\n~~~{python}\nprint('hello')\n~~~\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(false);
    expect(result.needsPython).toBe(true);
  });

  test("detects inline R code", () => {
    const content = "The value is `r sqrt(2)` in the text.\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(false);
  });

  test("detects inline Python code", () => {
    const content = "The length is `python len([1,2])` items.\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(false);
    expect(result.needsPython).toBe(true);
  });

  test("detects both fenced blocks and inline code", () => {
    const content =
      "```{r}\nlibrary(ggplot2)\n```\n\nThe answer is `python 1+1`.\n";
    const result = detectMarkdownLanguagesInContent(content);
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(true);
  });
});

function setupGlobDir(files: string[]) {
  mockReaddir.mockResolvedValue(files);
  mockStat.mockResolvedValue({ isFile: () => true });
}

describe("detectMarkdownLanguagesInDirectory", () => {
  test("detects Python in a non-entrypoint .Rmd file", async () => {
    setupGlobDir(["report.Rmd", "helper.Rmd"]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("report.Rmd")) {
        return Promise.resolve("# Title\n\n```{r}\nplot(1)\n```\n");
      }
      if (filePath.includes("helper.Rmd")) {
        return Promise.resolve("# Helper\n\n```{python}\nimport os\n```\n");
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await detectMarkdownLanguagesInDirectory("/project");
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(true);
  });

  test("accumulates R across multiple files", async () => {
    setupGlobDir(["a.Rmd", "b.Rmd"]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("a.Rmd")) {
        return Promise.resolve("# A\n\nNo code blocks here.\n");
      }
      if (filePath.includes("b.Rmd")) {
        return Promise.resolve("# B\n\n```{r}\nprint(1)\n```\n");
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await detectMarkdownLanguagesInDirectory("/project");
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(false);
  });

  test("empty directory returns both false", async () => {
    setupGlobDir([]);

    const result = await detectMarkdownLanguagesInDirectory("/project");
    expect(result.needsR).toBe(false);
    expect(result.needsPython).toBe(false);
  });

  test("unreadable files are skipped gracefully", async () => {
    setupGlobDir(["good.Rmd", "bad.Rmd"]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("good.Rmd")) {
        return Promise.resolve("```{r}\nplot(1)\n```\n");
      }
      return Promise.reject(new Error("EACCES"));
    });

    const result = await detectMarkdownLanguagesInDirectory("/project");
    expect(result.needsR).toBe(true);
    expect(result.needsPython).toBe(false);
  });
});
