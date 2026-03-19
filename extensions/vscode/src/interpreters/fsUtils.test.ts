// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi } from "vitest";
import { readFileText, fileExistsAt } from "./fsUtils";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn((filePath: string) => {
    if (filePath === "/exists.txt") {
      return Promise.resolve("hello world");
    }
    if (filePath === "/no-access.txt") {
      return Promise.reject(
        Object.assign(new Error("EACCES"), { code: "EACCES" }),
      );
    }
    return Promise.reject(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
  }),
  stat: vi.fn((filePath: string) => {
    if (filePath === "/exists.txt") {
      return Promise.resolve({ isFile: () => true });
    }
    if (filePath === "/exists-dir") {
      return Promise.resolve({ isFile: () => false });
    }
    return Promise.reject(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
  }),
}));

describe("readFileText", () => {
  test("returns file content as string when file exists", async () => {
    const result = await readFileText("/exists.txt");
    expect(result).toBe("hello world");
  });

  test("returns null when file does not exist", async () => {
    const result = await readFileText("/missing.txt");
    expect(result).toBeNull();
  });

  test("rethrows non-ENOENT errors", async () => {
    await expect(readFileText("/no-access.txt")).rejects.toThrow("EACCES");
  });
});

describe("fileExistsAt", () => {
  test("returns true when file exists", async () => {
    const result = await fileExistsAt("/exists.txt");
    expect(result).toBe(true);
  });

  test("returns false when file does not exist", async () => {
    const result = await fileExistsAt("/missing.txt");
    expect(result).toBe(false);
  });

  test("returns false when path is a directory", async () => {
    const result = await fileExistsAt("/exists-dir");
    expect(result).toBe(false);
  });
});
