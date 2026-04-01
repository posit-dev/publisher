// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { StaticHTMLDetector } from "./html";
import { ContentType } from "src/api/types/configurations";

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

describe("StaticHTMLDetector", () => {
  const detector = new StaticHTMLDetector();

  test("detects .html files", async () => {
    mockReaddir.mockResolvedValue(["index.html"]);
    mockStat.mockImplementation((path: string) => {
      if (path.endsWith("index.html")) {
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      // companion dirs don't exist
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.HTML);
    expect(configs[0]?.entrypoint).toBe("index.html");
    expect(configs[0]?.files).toContain("/index.html");
  });

  test("includes _site companion directory", async () => {
    mockReaddir.mockResolvedValue(["index.html"]);
    mockStat.mockImplementation((path: string) => {
      if (path.endsWith("index.html")) {
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      if (path.endsWith("_site")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project");
    expect(configs[0]?.files).toContain("/_site");
  });

  test("includes stem_files companion directory", async () => {
    mockReaddir.mockResolvedValue(["report.html"]);
    mockStat.mockImplementation((path: string) => {
      if (path.endsWith("report.html")) {
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      if (path.endsWith("report_files")) {
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
        });
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project");
    expect(configs[0]?.files).toContain("/report_files");
  });

  test("detects .htm files", async () => {
    mockReaddir.mockResolvedValue(["page.htm"]);
    mockStat.mockImplementation((path: string) => {
      if (path.endsWith("page.htm")) {
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.HTML);
    expect(configs[0]?.entrypoint).toBe("page.htm");
    expect(configs[0]?.files).toContain("/page.htm");
  });

  test("accepts .htm entrypoint filter", async () => {
    mockReaddir.mockResolvedValue(["page.htm"]);
    mockStat.mockImplementation((path: string) => {
      if (path.endsWith("page.htm")) {
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await detector.inferType("/project", "page.htm");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("page.htm");
  });

  test("skips non-html entrypoints", async () => {
    const configs = await detector.inferType("/project", "app.py");
    expect(configs).toHaveLength(0);
  });

  test("returns empty when no html files", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(0);
  });
});
