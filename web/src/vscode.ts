export const vscodeApi = typeof acquireVsCodeApi !== 'undefined' ?
  acquireVsCodeApi()
  : undefined;
