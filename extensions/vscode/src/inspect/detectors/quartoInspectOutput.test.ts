// Copyright (C) 2026 by Posit Software, PBC.

import path from "path";
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
    const input = path.join("/project", "doc.html");
    const result = await output.fileAssetsDir(input);
    expect(result).toBe(path.join("/project", "doc_files"));
  });

  test("returns undefined when companion directory does not exist", async () => {
    mockStat.mockRejectedValue(new Error("ENOENT"));

    const output = makeOutput();
    const input = path.join("/project", "doc.html");
    const result = await output.fileAssetsDir(input);
    expect(result).toBeUndefined();
  });

  test("returns undefined when path exists but is not a directory", async () => {
    mockStat.mockResolvedValue({
      isDirectory: () => false,
    });

    const output = makeOutput();
    const input = path.join("/project", "doc.html");
    const result = await output.fileAssetsDir(input);
    expect(result).toBeUndefined();
  });

  test("computes correct name from nested path", async () => {
    mockStat.mockResolvedValue({
      isDirectory: () => true,
    });

    const output = makeOutput();
    const input = path.join("/project", "subdir", "report.html");
    const result = await output.fileAssetsDir(input);
    expect(result).toBe(path.join("/project", "subdir", "report_files"));
  });
});
