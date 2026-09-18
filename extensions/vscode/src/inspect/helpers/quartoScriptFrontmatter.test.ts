// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  buildQuartoScriptFrontmatter,
  hasQuartoScriptFrontmatter,
} from "./quartoScriptFrontmatter";

describe("hasQuartoScriptFrontmatter", () => {
  test("detects R frontmatter", () => {
    const content = [
      "#' ---",
      '#\' title: "My Report"',
      "#' ---",
      "",
      "print('hello')",
      "",
    ].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "r")).toBe(true);
  });

  test("detects R frontmatter preceded by blank lines", () => {
    const content = ["", "#' ---", "#' ---", "1 + 1", ""].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "r")).toBe(true);
  });

  test("rejects R script with no frontmatter", () => {
    const content = "print('hello')\n";
    expect(hasQuartoScriptFrontmatter(content, "r")).toBe(false);
  });

  test("rejects R script with an unclosed frontmatter block", () => {
    const content = ["#' ---", '#\' title: "My Report"', "print('hello')"].join(
      "\n",
    );
    expect(hasQuartoScriptFrontmatter(content, "r")).toBe(false);
  });

  test("detects Python frontmatter", () => {
    const content = [
      "# %% [markdown]",
      "# ---",
      '# title: "My Report"',
      "# ---",
      "",
      "# %%",
      "print('hello')",
      "",
    ].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "python")).toBe(true);
  });

  test("rejects Python script with no markdown cell", () => {
    const content = "print('hello')\n";
    expect(hasQuartoScriptFrontmatter(content, "python")).toBe(false);
  });

  test("rejects Python markdown cell missing the closing delimiter", () => {
    const content = [
      "# %% [markdown]",
      "# ---",
      '# title: "My Report"',
      "",
      "print('hello')",
    ].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "python")).toBe(false);
  });
});

describe("buildQuartoScriptFrontmatter", () => {
  test("builds R frontmatter with the given title", () => {
    const result = buildQuartoScriptFrontmatter("r", "My Report");
    expect(result).toBe("#' ---\n#' title: \"My Report\"\n#' ---\n\n");
    expect(hasQuartoScriptFrontmatter(result, "r")).toBe(true);
  });

  test("builds Python frontmatter with the given title", () => {
    const result = buildQuartoScriptFrontmatter("python", "My Report");
    expect(result).toBe(
      '# %% [markdown]\n# ---\n# title: "My Report"\n# ---\n\n# %%\n\n',
    );
    expect(hasQuartoScriptFrontmatter(result, "python")).toBe(true);
  });

  test("escapes double quotes in the title", () => {
    const result = buildQuartoScriptFrontmatter("r", 'My "Report"');
    expect(result).toContain('title: "My \\"Report\\""');
  });
});
