// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { PyShinyDetector, hasShinyExpressImport } from "./pyshiny";
import { ContentType } from "src/api/types/configurations";

const { mockReaddir, mockStat, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readdir: mockReaddir,
  stat: mockStat,
  readFile: mockReadFile,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("hasShinyExpressImport", () => {
  test("detects 'import shiny.express'", () => {
    expect(hasShinyExpressImport("import shiny.express")).toBe(true);
  });

  test("detects 'from shiny.express import ui'", () => {
    expect(hasShinyExpressImport("from shiny.express import ui")).toBe(true);
  });

  test("detects 'from shiny import express'", () => {
    expect(hasShinyExpressImport("from shiny import express")).toBe(true);
  });

  test("returns false for plain shiny import", () => {
    expect(hasShinyExpressImport("from shiny import App")).toBe(false);
  });
});

describe("PyShinyDetector", () => {
  const detector = new PyShinyDetector();

  test("detects shiny app", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from shiny import App, ui\napp = App()\n");

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.PYTHON_SHINY);
    expect(configs[0]?.entrypoint).toBe("app.py");
    expect(configs[0]?.python).toEqual({});
    expect(configs[0]?.files).toContain("/app.py");
    expect(configs[0]?.entrypointObjectRef).toBeUndefined();
  });

  test("detects shiny express app with entrypointObjectRef", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue(
      "from shiny.express import ui\nui.h1('Hello')\n",
    );

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypointObjectRef).toBe("shiny.express.app:app_2e_py");
  });

  test("returns empty for non-shiny file", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("import flask\n");

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(0);
  });

  test("skips non-.py entrypoints", async () => {
    const configs = await detector.inferType("/project", "app.R");
    expect(configs).toHaveLength(0);
  });

  test("encodes hyphens in express entrypointObjectRef", async () => {
    mockReaddir.mockResolvedValue(["my-app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from shiny.express import ui\n");

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    // hyphen (0x2d) should be encoded as _2d_
    expect(configs[0]?.entrypointObjectRef).toBe(
      "shiny.express.app:my_2d_app_2e_py",
    );
  });

  test("encodes leading digits in express entrypointObjectRef", async () => {
    mockReaddir.mockResolvedValue(["1app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from shiny.express import ui\n");

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    // leading digit "1" (0x31) should be encoded as _31_
    expect(configs[0]?.entrypointObjectRef).toBe(
      "shiny.express.app:_31_app_2e_py",
    );
  });

  test("encodes spaces in express entrypointObjectRef", async () => {
    mockReaddir.mockResolvedValue(["my app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from shiny.express import ui\n");

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    // space (0x20) should be encoded as _20_
    expect(configs[0]?.entrypointObjectRef).toBe(
      "shiny.express.app:my_20_app_2e_py",
    );
  });

  test("leaves alphanumeric characters unchanged in express entrypointObjectRef", async () => {
    mockReaddir.mockResolvedValue(["myApp2.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from shiny.express import ui\n");

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    // only the dot should be encoded
    expect(configs[0]?.entrypointObjectRef).toBe(
      "shiny.express.app:myApp2_2e_py",
    );
  });
});
