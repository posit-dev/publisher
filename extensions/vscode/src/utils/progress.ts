// Copyright (C) 2024 by Posit Software, PBC.

import { ProgressLocation, window } from "vscode";

export async function showProgress(
  title: string,
  viewId: string | undefined,
  until: Promise<any>,
  trace = true,
) {
  const start = performance.now();
  window.withProgress(
    {
      title,
      location: viewId ? { viewId } : ProgressLocation.Window,
    },
    async () => {
      return until;
    },
  );
  await until;
  if (trace) {
    const duration = Math.round(Number(performance.now() - start));
    console.log(`Progress for "${title}" was displayed for ${duration}ms`);
  }
}
