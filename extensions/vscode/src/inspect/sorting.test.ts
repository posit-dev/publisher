// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { sortConfigs } from "./sorting";
import { ContentType } from "src/api/types/configurations";
import { PartialConfig } from "./types";

function cfg(entrypoint: string, type: ContentType): PartialConfig {
  return { entrypoint, type };
}

describe("sortConfigs", () => {
  test("prefers preferred name stems", () => {
    const configs = [
      cfg("other.py", ContentType.PYTHON_FLASK),
      cfg("app.py", ContentType.PYTHON_FLASK),
    ];
    const sorted = sortConfigs(configs, "myproject");
    expect(sorted[0]?.entrypoint).toBe("app.py");
  });

  test("prefers directory basename as entrypoint stem", () => {
    const configs = [
      cfg("app.py", ContentType.PYTHON_FLASK),
      cfg("myproject.py", ContentType.PYTHON_FLASK),
    ];
    const sorted = sortConfigs(configs, "myproject");
    // Both are preferred — myproject matches dir basename, app is in preferred list
    // When both preferred, falls to entrypoint alphabetical: app.py < myproject.py
    expect(sorted[0]?.entrypoint).toBe("app.py");
  });

  test("sorts by content type priority for same entrypoint", () => {
    const configs = [
      cfg("notebook.ipynb", ContentType.JUPYTER_NOTEBOOK),
      cfg("notebook.ipynb", ContentType.QUARTO_STATIC),
    ];
    const sorted = sortConfigs(configs, "project");
    expect(sorted[0]?.type).toBe(ContentType.QUARTO_STATIC);
    expect(sorted[1]?.type).toBe(ContentType.JUPYTER_NOTEBOOK);
  });

  test("sorts alphabetically by entrypoint when not preferred", () => {
    const configs = [
      cfg("zebra.py", ContentType.PYTHON_FLASK),
      cfg("alpha.py", ContentType.PYTHON_FLASK),
    ];
    const sorted = sortConfigs(configs, "project");
    expect(sorted[0]?.entrypoint).toBe("alpha.py");
    expect(sorted[1]?.entrypoint).toBe("zebra.py");
  });

  test("sorts alphabetically by type for same entrypoint and priority", () => {
    const configs = [
      cfg("app.py", ContentType.PYTHON_FLASK),
      cfg("app.py", ContentType.PYTHON_DASH),
    ];
    const sorted = sortConfigs(configs, "project");
    expect(sorted[0]?.type).toBe(ContentType.PYTHON_DASH);
    expect(sorted[1]?.type).toBe(ContentType.PYTHON_FLASK);
  });

  test("preferred names: index, main, app, streamlit_app", () => {
    const configs = [
      cfg("something.py", ContentType.PYTHON_FLASK),
      cfg("index.py", ContentType.PYTHON_FLASK),
      cfg("main.py", ContentType.PYTHON_FLASK),
      cfg("streamlit_app.py", ContentType.PYTHON_STREAMLIT),
    ];
    const sorted = sortConfigs(configs, "project");
    // Preferred names come first, non-preferred last
    expect(sorted[sorted.length - 1]?.entrypoint).toBe("something.py");
    // All preferred items should come before something.py
    const preferredEntrypoints = sorted.slice(0, -1).map((c) => c.entrypoint);
    expect(preferredEntrypoints).toContain("index.py");
    expect(preferredEntrypoints).toContain("main.py");
    expect(preferredEntrypoints).toContain("streamlit_app.py");
  });
});
