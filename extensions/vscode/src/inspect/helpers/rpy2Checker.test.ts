// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { hasRpy2Dependency } from "./rpy2Checker";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("hasRpy2Dependency", () => {
  test("returns true when rpy2 is in requirements.txt", async () => {
    mockReadFile.mockResolvedValue("flask==2.0\nrpy2==3.5.1\npandas\n");
    expect(await hasRpy2Dependency("/project")).toBe(true);
  });

  test("returns true for rpy2 without version specifier", async () => {
    mockReadFile.mockResolvedValue("rpy2\n");
    expect(await hasRpy2Dependency("/project")).toBe(true);
  });

  test("returns true for rpy2 with >= specifier", async () => {
    mockReadFile.mockResolvedValue("rpy2>=3.0\n");
    expect(await hasRpy2Dependency("/project")).toBe(true);
  });

  test("returns false when rpy2 is not present", async () => {
    mockReadFile.mockResolvedValue("flask==2.0\npandas\n");
    expect(await hasRpy2Dependency("/project")).toBe(false);
  });

  test("returns false when requirements.txt does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    expect(await hasRpy2Dependency("/project")).toBe(false);
  });

  test("does not match rpy2extra (different package)", async () => {
    mockReadFile.mockResolvedValue("rpy2extra==1.0\n");
    expect(await hasRpy2Dependency("/project")).toBe(false);
  });
});
