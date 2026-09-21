// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import * as yaml from "js-yaml";
import {
  buildQuartoScriptFrontmatter,
  hasQuartoScriptFrontmatter,
  insertQuartoScriptFrontmatter,
  type ScriptLanguage,
} from "./quartoScriptFrontmatter";

// Strip the comment prefix off each frontmatter line and parse what's left as
// YAML — the same thing Quarto does when it renders the script — so the tests
// assert the title survives the round trip rather than matching an escaping
// scheme character by character.
function parseFrontmatter(
  block: string,
  language: ScriptLanguage,
): Record<string, unknown> {
  const prefix = language === "r" ? "#'" : "#";
  const uncommented = block
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
  const open = uncommented.indexOf("---");
  const close = uncommented.indexOf("---", open + 1);
  if (open === -1 || close === -1) {
    throw new Error(`No delimited frontmatter block found in: ${block}`);
  }
  const parsed = yaml.load(uncommented.slice(open + 1, close).join("\n"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Frontmatter did not parse to an object: ${body}`);
  }
  return parsed;
}

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

  test("detects R frontmatter after a shebang line", () => {
    const content = [
      "#!/usr/bin/env Rscript",
      "#' ---",
      '#\' title: "My Report"',
      "#' ---",
      "",
      "print('hello')",
      "",
    ].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "r")).toBe(true);
  });

  test("detects Python frontmatter after a shebang line", () => {
    const content = [
      "#!/usr/bin/env python3",
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

  test("rejects a later, unrelated comment block delimited by --- lines (R)", () => {
    const content = [
      "print('hello')",
      "",
      "#' ---",
      "#' not real frontmatter",
      "#' ---",
    ].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "r")).toBe(false);
  });

  test("rejects a later, unrelated markdown cell delimited by --- lines (Python)", () => {
    const content = [
      "print('hello')",
      "",
      "# %% [markdown]",
      "# ---",
      "# not real frontmatter",
      "# ---",
    ].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "python")).toBe(false);
  });

  test("rejects a Python markdown cell left unclosed by the next cell", () => {
    const content = [
      "# %% [markdown]",
      "# ---",
      '# title: "My Report"',
      "# %% [markdown]",
      "# ---",
      "# ## Section",
      "# ---",
    ].join("\n");
    expect(hasQuartoScriptFrontmatter(content, "python")).toBe(false);
  });

  test("rejects a Python markdown cell with prose before the opening delimiter", () => {
    const content = [
      "# %% [markdown]",
      "# Some notes about this script",
      "# ---",
      '# title: "My Report"',
      "# ---",
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

  test("escapes backslashes in the title", () => {
    const result = buildQuartoScriptFrontmatter("r", "C:\\Users\\me");
    expect(result).toContain('title: "C:\\\\Users\\\\me"');
  });

  // Titles are free-form user input, so they can contain characters that are
  // meaningful inside a double-quoted YAML scalar. `\U` in particular starts a
  // Unicode escape and makes the whole block fail to parse when unescaped.
  test.each<[string, string]>([
    ["a backslash path", "C:\\Users\\me"],
    ["a tab-like escape", "My \\three Report"],
    ["a Unicode-like escape", "My \\Ultimate Report"],
    ["a trailing backslash", "Report\\"],
    ["both quotes and backslashes", 'My "C:\\temp" Report'],
  ])("round-trips a title containing %s", (_label, title) => {
    for (const language of ["r", "python"] as const) {
      const result = buildQuartoScriptFrontmatter(language, title);
      expect(parseFrontmatter(result, language).title).toBe(title);
      expect(hasQuartoScriptFrontmatter(result, language)).toBe(true);
    }
  });
});

describe("insertQuartoScriptFrontmatter", () => {
  test("prepends frontmatter when there is no shebang", () => {
    const content = "print('hello')\n";
    const result = insertQuartoScriptFrontmatter(content, "r", "My Report");
    expect(result).toBe(
      "#' ---\n#' title: \"My Report\"\n#' ---\n\nprint('hello')\n",
    );
    expect(hasQuartoScriptFrontmatter(result, "r")).toBe(true);
  });

  test("inserts frontmatter after a shebang line (R)", () => {
    const content = "#!/usr/bin/env Rscript\nprint('hello')\n";
    const result = insertQuartoScriptFrontmatter(content, "r", "My Report");
    expect(result).toBe(
      "#!/usr/bin/env Rscript\n#' ---\n#' title: \"My Report\"\n#' ---\n\nprint('hello')\n",
    );
    expect(result.split("\n")[0]).toBe("#!/usr/bin/env Rscript");
    expect(hasQuartoScriptFrontmatter(result, "r")).toBe(true);
  });

  test("inserts frontmatter after a shebang line (Python)", () => {
    const content = "#!/usr/bin/env python3\nprint('hello')\n";
    const result = insertQuartoScriptFrontmatter(
      content,
      "python",
      "My Report",
    );
    expect(result.split("\n")[0]).toBe("#!/usr/bin/env python3");
    expect(hasQuartoScriptFrontmatter(result, "python")).toBe(true);
  });

  test("does not treat a mid-file '#!' as a shebang", () => {
    const content = "print('hello')\n#!not a shebang\n";
    const result = insertQuartoScriptFrontmatter(content, "r", "My Report");
    expect(result.startsWith("#' ---")).toBe(true);
  });
});
