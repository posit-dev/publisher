// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { runDetectors } from "./detectorRunner";
import { ContentType } from "src/api/types/configurations";

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("runDetectors", () => {
  test("returns unknown config when no detectors match", async () => {
    mockReaddir.mockResolvedValue([]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await runDetectors("/empty-project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.UNKNOWN);
  });

  test("detects flask app", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await runDetectors("/project");
    const flaskConfig = configs.find(
      (c) => c.type === ContentType.PYTHON_FLASK,
    );
    expect(flaskConfig).toBeDefined();
    expect(flaskConfig?.entrypoint).toBe("app.py");
  });

  test("detects R Shiny app", async () => {
    mockReaddir.mockResolvedValue([]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("");
    mockAccess.mockImplementation((path: string) => {
      if (path.endsWith("app.R")) return Promise.resolve();
      return Promise.reject(new Error("ENOENT"));
    });

    const configs = await runDetectors("/project");
    const shinyConfig = configs.find((c) => c.type === ContentType.R_SHINY);
    expect(shinyConfig).toBeDefined();
    expect(shinyConfig?.entrypoint).toBe("app.R");
  });

  test("returns sorted results", async () => {
    mockReaddir.mockResolvedValue(["z_app.py", "app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const configs = await runDetectors("/project");
    const flaskConfigs = configs.filter(
      (c) => c.type === ContentType.PYTHON_FLASK,
    );
    // app.py is a preferred name, should come first
    expect(flaskConfigs[0]?.entrypoint).toBe("app.py");
  });
});
