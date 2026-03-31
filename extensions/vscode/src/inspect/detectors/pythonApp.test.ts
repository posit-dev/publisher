// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import {
  newFlaskDetector,
  newFastAPIDetector,
  newDashDetector,
  newStreamlitDetector,
  newBokehDetector,
} from "./pythonApp";
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

describe("PythonAppDetector", () => {
  describe("FlaskDetector", () => {
    const detector = newFlaskDetector();

    test("detects flask import", async () => {
      mockReaddir.mockResolvedValue(["app.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue(
        "from flask import Flask\napp = Flask(__name__)\n",
      );

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(1);
      expect(configs[0]?.type).toBe(ContentType.PYTHON_FLASK);
      expect(configs[0]?.entrypoint).toBe("app.py");
      expect(configs[0]?.python).toEqual({});
    });

    test("detects flasgger import", async () => {
      mockReaddir.mockResolvedValue(["app.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue("from flasgger import Swagger\n");

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(1);
      expect(configs[0]?.type).toBe(ContentType.PYTHON_FLASK);
    });

    test("returns empty for non-flask file", async () => {
      mockReaddir.mockResolvedValue(["app.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue("import os\n");

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(0);
    });

    test("skips non-.py entrypoints", async () => {
      const configs = await detector.inferType("/project", "app.R");
      expect(configs).toHaveLength(0);
    });
  });

  describe("FastAPIDetector", () => {
    const detector = newFastAPIDetector();

    test("detects fastapi import", async () => {
      mockReaddir.mockResolvedValue(["main.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue("from fastapi import FastAPI\n");

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(1);
      expect(configs[0]?.type).toBe(ContentType.PYTHON_FASTAPI);
    });

    test("detects starlette import", async () => {
      mockReaddir.mockResolvedValue(["app.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue(
        "from starlette.applications import Starlette\n",
      );

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(1);
      expect(configs[0]?.type).toBe(ContentType.PYTHON_FASTAPI);
    });
  });

  describe("DashDetector", () => {
    const detector = newDashDetector();

    test("detects dash import", async () => {
      mockReaddir.mockResolvedValue(["app.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue("import dash\n");

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(1);
      expect(configs[0]?.type).toBe(ContentType.PYTHON_DASH);
    });
  });

  describe("StreamlitDetector", () => {
    const detector = newStreamlitDetector();

    test("detects streamlit import", async () => {
      mockReaddir.mockResolvedValue(["streamlit_app.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue("import streamlit as st\n");

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(1);
      expect(configs[0]?.type).toBe(ContentType.PYTHON_STREAMLIT);
    });
  });

  describe("BokehDetector", () => {
    const detector = newBokehDetector();

    test("detects bokeh import", async () => {
      mockReaddir.mockResolvedValue(["app.py"]);
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue("from bokeh.plotting import figure\n");

      const configs = await detector.inferType("/project");
      expect(configs).toHaveLength(1);
      expect(configs[0]?.type).toBe(ContentType.PYTHON_BOKEH);
    });
  });

  test("filters to specific entrypoint", async () => {
    const detector = newFlaskDetector();
    mockReaddir.mockResolvedValue(["app.py", "other.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");

    const configs = await detector.inferType("/project", "app.py");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("app.py");
  });
});
