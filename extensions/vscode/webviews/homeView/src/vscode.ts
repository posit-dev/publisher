import { WebviewApi } from "vscode-webview";

let apiInstance: WebviewApi<unknown> | undefined = undefined;

export const vscodeAPI = (): WebviewApi<unknown> => {
  if (!apiInstance) {
    apiInstance = acquireVsCodeApi();
  }
  return apiInstance;
};
