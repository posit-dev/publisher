// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getRRequires } from "./rRequires";

const mockFiles: Record<string, string> = {};

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn((filePath: string) => {
    const content = mockFiles[filePath];
    if (content === undefined) {
      return Promise.reject(new Error(`ENOENT: ${filePath}`));
    }
    return Promise.resolve(content);
  }),
}));

function setFile(projectDir: string, filename: string, content: string) {
  mockFiles[`${projectDir}/${filename}`] = content;
}

describe("getRRequires", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
  });

  test("returns empty string when no files exist", async () => {
    const result = await getRRequires("/project");
    expect(result).toBe("");
  });

  describe("DESCRIPTION", () => {
    test("reads R version from Depends line", async () => {
      setFile(
        "/project",
        "DESCRIPTION",
        "Depends: package1, R (>= 3.5.0), package3",
      );
      const result = await getRRequires("/project");
      expect(result).toBe(">= 3.5.0");
    });

    test("reads R version from continuation lines", async () => {
      setFile(
        "/project",
        "DESCRIPTION",
        "Depends: package1\n R (>3.5)\n package3",
      );
      const result = await getRRequires("/project");
      expect(result).toBe(">3.5");
    });

    test("reads R version from tab-indented continuation", async () => {
      setFile(
        "/project",
        "DESCRIPTION",
        "Depends: package1\n\tR (>7.3)\n\tpackage3",
      );
      const result = await getRRequires("/project");
      expect(result).toBe(">7.3");
    });

    test("returns empty when no R dependency", async () => {
      setFile(
        "/project",
        "DESCRIPTION",
        "Depends: package1, package2, package3",
      );
      const result = await getRRequires("/project");
      expect(result).toBe("");
    });

    test("does not match tinyR", async () => {
      setFile(
        "/project",
        "DESCRIPTION",
        "Depends: package1\n tinyR (<3.5)\n package3",
      );
      const result = await getRRequires("/project");
      expect(result).toBe("");
    });

    test("takes priority over renv.lock", async () => {
      setFile("/project", "DESCRIPTION", "Depends: R (>= 4.0.0)");
      setFile(
        "/project",
        "renv.lock",
        JSON.stringify({ R: { Version: "4.3.2" } }),
      );
      const result = await getRRequires("/project");
      expect(result).toBe(">= 4.0.0");
    });
  });

  describe("renv.lock", () => {
    test("reads R version and adapts to compatible constraint", async () => {
      setFile(
        "/project",
        "renv.lock",
        JSON.stringify({ R: { Version: "4.3.2" } }),
      );
      const result = await getRRequires("/project");
      expect(result).toBe("~=4.3.0");
    });

    test("returns empty string for missing R section", async () => {
      setFile("/project", "renv.lock", JSON.stringify({ Packages: {} }));
      const result = await getRRequires("/project");
      expect(result).toBe("");
    });

    test("returns empty string for invalid JSON", async () => {
      setFile("/project", "renv.lock", "not json");
      const result = await getRRequires("/project");
      expect(result).toBe("");
    });
  });
});
