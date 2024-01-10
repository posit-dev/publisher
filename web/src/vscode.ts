// Copyright (C) 2023 by Posit Software, PBC.

export const vscodeApi = typeof acquireVsCodeApi !== 'undefined' ?
  acquireVsCodeApi()
  : undefined;
