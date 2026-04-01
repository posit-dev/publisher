// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { NotebookDetector } from "./notebook";
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

function makeNotebook(codeCells: string[][]): string {
  return JSON.stringify({
    cells: codeCells.map((source) => ({
      cell_type: "code",
      source,
    })),
  });
}

describe("NotebookDetector", () => {
  const detector = new NotebookDetector();

  test("detects jupyter notebook", async () => {
    mockReaddir.mockResolvedValue(["analysis.ipynb"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue(makeNotebook([["import pandas\n"]]));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.JUPYTER_NOTEBOOK);
    expect(configs[0]?.entrypoint).toBe("analysis.ipynb");
    expect(configs[0]?.python).toEqual({});
  });

  test("detects voila notebook with ipywidgets", async () => {
    mockReaddir.mockResolvedValue(["dashboard.ipynb"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue(
      makeNotebook([["import ipywidgets\n", "w = ipywidgets.Slider()\n"]]),
    );

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.JUPYTER_VOILA);
  });

  test("detects voila notebook with bqplot", async () => {
    mockReaddir.mockResolvedValue(["viz.ipynb"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue(makeNotebook([["import bqplot\n"]]));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.type).toBe(ContentType.JUPYTER_VOILA);
  });

  test("skips empty notebooks", async () => {
    mockReaddir.mockResolvedValue(["empty.ipynb"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue(JSON.stringify({ cells: [] }));

    const configs = await detector.inferType("/project");
    expect(configs).toHaveLength(0);
  });

  test("skips non-.ipynb entrypoints", async () => {
    const configs = await detector.inferType("/project", "app.py");
    expect(configs).toHaveLength(0);
  });

  test("filters to specific entrypoint", async () => {
    mockReaddir.mockResolvedValue(["a.ipynb", "b.ipynb"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue(makeNotebook([["x = 1\n"]]));

    const configs = await detector.inferType("/project", "a.ipynb");
    expect(configs).toHaveLength(1);
    expect(configs[0]?.entrypoint).toBe("a.ipynb");
  });
});
