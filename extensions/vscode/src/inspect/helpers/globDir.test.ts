// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { globDir } from "./globDir";

const { mockReaddir, mockStat } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readdir: mockReaddir,
  stat: mockStat,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("globDir", () => {
  test("returns matching files sorted", async () => {
    mockReaddir.mockResolvedValue(["b.py", "a.py", "readme.md"]);
    mockStat.mockResolvedValue({ isFile: () => true });

    const result = await globDir("/project", "*.py");
    expect(result).toEqual(["/project/a.py", "/project/b.py"]);
  });

  test("returns empty array when directory does not exist", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));

    const result = await globDir("/nonexistent", "*.py");
    expect(result).toEqual([]);
  });

  test("excludes directories from results", async () => {
    mockReaddir.mockResolvedValue(["app.py", "tests"]);
    mockStat.mockImplementation((filePath: string) => {
      if (filePath.endsWith("tests")) {
        return Promise.resolve({ isFile: () => false });
      }
      return Promise.resolve({ isFile: () => true });
    });

    const result = await globDir("/project", "*");
    expect(result).toEqual(["/project/app.py"]);
  });

  test("matches html and htm patterns", async () => {
    mockReaddir.mockResolvedValue(["index.html", "page.htm", "app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });

    const result = await globDir("/project", "*.html");
    expect(result).toEqual(["/project/index.html"]);
  });
});
