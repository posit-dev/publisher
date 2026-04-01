// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { detectMarkdownLanguagesInContent } from "./markdownLanguages";

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
});
