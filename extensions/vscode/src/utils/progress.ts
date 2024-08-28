// Copyright (C) 2024 by Posit Software, PBC.

import { ProgressLocation, window } from "vscode";

export async function showProgress<T>(
  title: string,
  viewId: string,
  until: () => Promise<T>,
  trace = true,
): Promise<T> {
  const start = performance.now();

  try {
    return await window.withProgress(
      {
        title,
        location: viewId ? { viewId } : ProgressLocation.Window,
      },
      until,
    );
  } finally {
    if (trace) {
      const duration = Math.round(Number(performance.now() - start));
      console.log(`Progress for "${title}" was displayed for ${duration}ms`);
    }
  }
}
