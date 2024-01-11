// Copyright (C) 2023 by Posit Software, PBC.

export const vscode = typeof acquireVsCodeApi !== 'undefined' ?
  acquireVsCodeApi()
  : undefined;
