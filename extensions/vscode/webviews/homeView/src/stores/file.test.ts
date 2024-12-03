import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { WebviewApi } from "vscode-webview";

import { vscodeAPI } from "src/vscode";
import { useFileStore } from "src/stores/file";

vi.mock(import("src/vscode"));

vi.mock("src/vscode", () => {
  const postMessage = vi.fn();

  const vscodeAPI = vi.fn(() => ({
    postMessage: postMessage,
  }));

  return { vscodeAPI };
});

describe("File Store", () => {
  let vscodeApi: WebviewApi<unknown>;

  beforeEach(() => {
    vscodeApi = vscodeAPI();

    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  test("initializes with no expanded directories", () => {
    const file = useFileStore();
    expect(file.expandedDirs.size).toBe(0);
  });

  test("refreshing files sends a message to vscode", () => {
    const file = useFileStore();
    file.refreshFiles();
    expect(vscodeApi.postMessage).toHaveBeenCalledWith(
      JSON.stringify({
        kind: "requestFilesLists",
      }),
    );
  });

  test("including a file sends a message to vscode", () => {
    const file = useFileStore();
    file.includeFile({ id: "file" });
    expect(vscodeApi.postMessage).toHaveBeenCalledWith(
      JSON.stringify({
        kind: "includeFile",
        content: { path: "file" },
      }),
    );
  });

  test("excluding a file sends a message to vscode", () => {
    const file = useFileStore();
    file.excludeFile({ id: "file" });
    expect(vscodeApi.postMessage).toHaveBeenCalledWith(
      JSON.stringify({
        kind: "excludeFile",
        content: { path: "file" },
      }),
    );
  });

  test("opening a file sends a message to vscode", () => {
    const file = useFileStore();
    file.openFile({ id: "file" });
    expect(vscodeApi.postMessage).toHaveBeenCalledWith(
      JSON.stringify({
        kind: "VSCodeOpenRelativeMsg",
        content: { relativePath: "file" },
      }),
    );
  });

  test("expanding a directory adds it to the expanded directories", () => {
    const file = useFileStore();
    file.expandDir({ id: "dir" });
    expect(file.expandedDirs.has("dir")).toBe(true);
  });

  test("collapsing a directory removes it from the expanded directories", () => {
    const file = useFileStore();
    file.expandDir({ id: "dir" });
    file.collapseDir({ id: "dir" });
    expect(file.expandedDirs.has("dir")).toBe(false);
  });
});
