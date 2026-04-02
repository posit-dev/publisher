// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi } from "vitest";
import { QuartoInspectOutput } from "./quartoInspectOutput";

const { mockStat } = vi.hoisted(() => ({
  mockStat: vi.fn(),
}));

vi.mock("src/logging");

vi.mock("fs/promises", () => ({
  stat: mockStat,
}));

function makeOutput(
  overrides: Record<string, unknown> = {},
): QuartoInspectOutput {
  const base = {
    quarto: { version: "1.4.553" },
    engines: ["markdown"],
    files: { input: [], configResources: [] },
    ...overrides,
  };
  return new QuartoInspectOutput(JSON.stringify(base));
}

describe("QuartoInspectOutput.fileAssetsDir", () => {
  test("returns path when companion directory exists", async () => {
    mockStat.mockResolvedValue({
      isDirectory: () => true,
    });

    const output = makeOutput();
    const result = await output.fileAssetsDir("/project/doc.html");
    expect(result).toBe("/project/doc_files");
  });

  test("returns undefined when companion directory does not exist", async () => {
    mockStat.mockRejectedValue(new Error("ENOENT"));

    const output = makeOutput();
    const result = await output.fileAssetsDir("/project/doc.html");
    expect(result).toBeUndefined();
  });

  test("returns undefined when path exists but is not a directory", async () => {
    mockStat.mockResolvedValue({
      isDirectory: () => false,
    });

    const output = makeOutput();
    const result = await output.fileAssetsDir("/project/doc.html");
    expect(result).toBeUndefined();
  });

  test("computes correct name from nested path", async () => {
    mockStat.mockResolvedValue({
      isDirectory: () => true,
    });

    const output = makeOutput();
    const result = await output.fileAssetsDir("/project/subdir/report.html");
    expect(result).toBe("/project/subdir/report_files");
  });
});
