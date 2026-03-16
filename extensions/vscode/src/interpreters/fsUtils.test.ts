// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi } from "vitest";
import { readFileText, fileExistsAt } from "./fsUtils";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn((filePath: string) => {
    if (filePath === "/exists.txt") {
      return Promise.resolve("hello world");
    }
    if (filePath === "/no-permission.txt") {
      return Promise.reject(
        Object.assign(new Error("EACCES: permission denied"), {
          code: "EACCES",
        }),
      );
    }
    return Promise.reject(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
  }),
  access: vi.fn((filePath: string) => {
    if (filePath === "/exists.txt") {
      return Promise.resolve();
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

  test("propagates non-ENOENT errors", async () => {
    await expect(readFileText("/no-permission.txt")).rejects.toThrow(
      "EACCES: permission denied",
    );
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
});
