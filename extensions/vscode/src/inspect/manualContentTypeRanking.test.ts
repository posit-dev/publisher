// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { ContentType } from "src/api/types/configurations";
import {
  manualContentTypeChoices,
  planManualContentTypeItems,
  suggestedContentTypesByExtension,
} from "./manualContentTypeRanking";

function contentTypesOf(
  entries: ReturnType<typeof planManualContentTypeItems>,
): ContentType[] {
  return entries.flatMap((entry) =>
    entry.kind === "type" ? [entry.contentType] : [],
  );
}

describe("manualContentTypeChoices", () => {
  test("never offers the legacy quarto alias for quarto-static", () => {
    expect(manualContentTypeChoices).not.toContain(ContentType.QUARTO);
  });
});

describe("planManualContentTypeItems", () => {
  test("ranks a Script entry first for an R script entrypoint", () => {
    const entries = planManualContentTypeItems("script.R");

    expect(entries[0]).toEqual({
      kind: "separator",
      label: "Suggested for script.R",
    });
    expect(entries[1]).toEqual({ kind: "script", language: "r" });
  });

  test("ranks a Script entry first for a Python script entrypoint", () => {
    const entries = planManualContentTypeItems("app.py");

    expect(entries[0]).toEqual({
      kind: "separator",
      label: "Suggested for app.py",
    });
    expect(entries[1]).toEqual({ kind: "script", language: "python" });
  });

  test("is case-insensitive on the entrypoint extension", () => {
    const entries = planManualContentTypeItems("script.PY");
    expect(entries[1]).toEqual({ kind: "script", language: "python" });
  });

  test("includes no Script entry, and no Suggested group, for an unmapped extension", () => {
    const entries = planManualContentTypeItems("run.sh");

    expect(entries.some((entry) => entry.kind === "script")).toBe(false);
    expect(entries.some((entry) => entry.kind === "separator")).toBe(false);
    expect(contentTypesOf(entries)).toEqual(manualContentTypeChoices);
  });

  test("drops no content type from the combined list, for every mapped extension without a Script entry", () => {
    for (const [ext, suggestion] of Object.entries(
      suggestedContentTypesByExtension,
    )) {
      if (suggestion?.script) {
        continue;
      }
      const entries = planManualContentTypeItems(`entrypoint${ext}`);
      expect(new Set(contentTypesOf(entries))).toEqual(
        new Set(manualContentTypeChoices),
      );
      expect(contentTypesOf(entries)).toHaveLength(
        manualContentTypeChoices.length,
      );
    }
  });

  test("drops the generic Quarto Document type for extensions with a Script entry, since only the Script entry sets the required engine", () => {
    for (const entrypoint of ["script.R", "app.py"]) {
      const entries = planManualContentTypeItems(entrypoint);
      expect(contentTypesOf(entries)).not.toContain(ContentType.QUARTO_STATIC);
      expect(entries.some((entry) => entry.kind === "script")).toBe(true);
    }
  });

  test("does not duplicate a suggested type into the All content types group", () => {
    const entries = planManualContentTypeItems("report.qmd");
    const types = contentTypesOf(entries);
    expect(types.filter((t) => t === ContentType.QUARTO_STATIC)).toHaveLength(
      1,
    );
  });

  test("uses a separate Suggested group for each mapped extension's own ranking", () => {
    const rEntries = planManualContentTypeItems("app.R");
    const suggestedForR = rEntries
      .slice(
        1,
        rEntries.findIndex((e) => e.kind === "separator" && e !== rEntries[0]),
      )
      .flatMap((e) => (e.kind === "type" ? [e.contentType] : []));
    expect(suggestedForR).toEqual([ContentType.R_SHINY, ContentType.R_PLUMBER]);
  });
});
