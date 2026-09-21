// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  buildQuartoScriptFrontmatter,
  hasQuartoScriptFrontmatter,
  insertQuartoScriptFrontmatter,
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
