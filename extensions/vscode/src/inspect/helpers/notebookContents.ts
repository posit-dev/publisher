// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";

interface NotebookCell {
  cell_type: string;
  source: string[];
}

interface NotebookContents {
  cells?: NotebookCell[];
}

/**
 * Extract code cell source from a Jupyter notebook file.
 * Returns all code cell sources joined with newlines.
 */
export async function getNotebookCodeInputs(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath, "utf-8");
  const notebook: NotebookContents = JSON.parse(raw);

  if (!notebook.cells || notebook.cells.length === 0) {
    return "";
  }

  const lines: string[] = [];
  for (const cell of notebook.cells) {
    if (cell.cell_type === "code" && Array.isArray(cell.source)) {
      for (const line of cell.source) {
        lines.push(line);
      }
    }
  }
  return lines.join("\n");
}
