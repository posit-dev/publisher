// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { ContentType } from "src/api/types/configurations";
import type { PartialConfig } from "./types";

const { mockRunDetectors } = vi.hoisted(() => ({
  mockRunDetectors: vi.fn(),
}));

vi.mock("./detectorRunner", () => ({
  runDetectors: mockRunDetectors,
}));

vi.mock("src/logging");

vi.mock("src/interpreters/pythonInterpreter", () => ({
  detectPythonInterpreter: vi.fn().mockResolvedValue({
    config: { version: "", packageFile: "", packageManager: "" },
    preferredPath: "",
  }),
}));

vi.mock("src/interpreters/rInterpreter", () => ({
  detectRInterpreter: vi.fn().mockResolvedValue({
    config: { version: "", packageFile: "", packageManager: "" },
    preferredPath: "",
  }),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  access: vi.fn().mockRejectedValue(new Error("ENOENT")),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("inspectProject alternatives", () => {
  test("passes alternatives through to ConfigurationInspectionResult", async () => {
    const quartoConfig: PartialConfig = {
      type: ContentType.QUARTO_STATIC,
      entrypoint: "report.qmd",
      source: "report.qmd",
      quarto: { version: "1.4.0", engines: ["markdown"] },
      alternatives: [
        {
          type: ContentType.HTML,
          entrypoint: "report.html",
          source: "report.qmd",
          files: ["/report.html"],
        },
      ],
    };
    mockRunDetectors.mockResolvedValue([quartoConfig]);

    // Dynamic import to pick up the mocked detectorRunner
    const { inspectProject } = await import("./index");

    const results = await inspectProject({ projectDir: "/project" });

    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.configuration.type).toBe(ContentType.QUARTO_STATIC);
    expect(result.configuration.alternatives).toBeDefined();
    expect(result.configuration.alternatives).toHaveLength(1);

    const alt = result.configuration.alternatives![0]!;
    expect(alt.type).toBe(ContentType.HTML);
    expect(alt.entrypoint).toBe("report.html");
    expect(alt.source).toBe("report.qmd");
    expect(alt.$schema).toContain("posit-publishing-schema");
    expect(alt.validate).toBe(true);
    // Matches Go: alternatives are not normalized, so they don't get
    // productType, comments, or interpreter config
    expect(alt.productType).toBe("");
    expect(alt.comments).toBeUndefined();
    expect(alt.python).toBeUndefined();
    expect(alt.r).toBeUndefined();
  });

  test("omits alternatives when detector provides none", async () => {
    const htmlConfig: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "index.html",
    };
    mockRunDetectors.mockResolvedValue([htmlConfig]);

    const { inspectProject } = await import("./index");

    const results = await inspectProject({ projectDir: "/project" });

    expect(results).toHaveLength(1);
    expect(results[0]!.configuration.alternatives).toBeUndefined();
  });
});
