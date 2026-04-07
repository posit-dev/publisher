// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { inspectProject } from "./index";
import { ContentType } from "src/api/types/configurations";
import type { PartialConfig } from "./types";

const { mockReaddir, mockStat, mockReadFile, mockAccess } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockReadFile: vi.fn(),
  mockAccess: vi.fn(),
}));

vi.mock("src/logging");

vi.mock("fs/promises", () => ({
  readdir: mockReaddir,
  stat: mockStat,
  readFile: mockReadFile,
  access: mockAccess,
}));

vi.mock("src/interpreters/pythonInterpreter", () => ({
  detectPythonInterpreter: vi.fn().mockResolvedValue({
    config: {
      version: "3.11.0",
      packageFile: "requirements.txt",
      packageManager: "auto",
    },
    preferredPath: "python3",
  }),
}));

vi.mock("src/interpreters/rInterpreter", () => ({
  detectRInterpreter: vi.fn().mockResolvedValue({
    config: {
      version: "4.3.0",
      packageFile: "renv.lock",
      packageManager: "renv",
    },
    preferredPath: "R",
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("inspectProject", () => {
  test("returns ConfigurationInspectionResult[] for flask project", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({
      projectDir: "/myproject",
      pythonPath: "python3",
    });

    expect(results.length).toBeGreaterThan(0);
    const flask = results.find(
      (r) => r.configuration.type === ContentType.PYTHON_FLASK,
    );
    expect(flask).toBeDefined();
    expect(flask?.configuration.entrypoint).toBe("app.py");
    expect(flask?.configuration.$schema).toContain("posit-publishing-schema");
    expect(flask?.configuration.validate).toBe(true);
    expect(flask?.projectDir).toBe(".");
  });

  test("returns unknown config for empty project", async () => {
    mockReaddir.mockResolvedValue([]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({ projectDir: "/empty" });
    expect(results).toHaveLength(1);
    expect(results[0]?.configuration.type).toBe(ContentType.UNKNOWN);
  });

  test("sets projectDir to '.' for non-recursive", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({ projectDir: "/project" });
    for (const result of results) {
      expect(result.projectDir).toBe(".");
    }
  });
});
