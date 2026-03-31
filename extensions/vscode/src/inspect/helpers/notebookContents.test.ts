// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { getNotebookCodeInputs } from "./notebookContents";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("getNotebookCodeInputs", () => {
  test("extracts code cell sources", async () => {
    const notebook = {
      cells: [
        { cell_type: "code", source: ["import os\n", "print('hello')\n"] },
        { cell_type: "markdown", source: ["# Title\n"] },
        { cell_type: "code", source: ["x = 1\n"] },
      ],
    };
    mockReadFile.mockResolvedValue(JSON.stringify(notebook));

    const result = await getNotebookCodeInputs("/test/notebook.ipynb");
    expect(result).toBe("import os\n\nprint('hello')\n\nx = 1\n");
  });

  test("returns empty string for notebook with no cells", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ cells: [] }));

    const result = await getNotebookCodeInputs("/test/empty.ipynb");
    expect(result).toBe("");
  });

  test("returns empty string for notebook with only markdown cells", async () => {
    const notebook = {
      cells: [{ cell_type: "markdown", source: ["# Title\n"] }],
    };
    mockReadFile.mockResolvedValue(JSON.stringify(notebook));

    const result = await getNotebookCodeInputs("/test/markdown.ipynb");
    expect(result).toBe("");
  });

  test("throws on invalid JSON", async () => {
    mockReadFile.mockResolvedValue("not json");

    await expect(
      getNotebookCodeInputs("/test/invalid.ipynb"),
    ).rejects.toThrow();
  });
});
