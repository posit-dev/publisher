// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublishResult } from "src/publish/connectPublish";
import { runTsDeployWithProgress } from "./tsDeployProgress";

// Mock vscode module
const mockReport = vi.fn();
const mockShowInformationMessage = vi.fn().mockResolvedValue(undefined);
const mockShowErrorMessage = vi.fn();
const mockOpenExternal = vi.fn();

vi.mock("vscode", () => ({
  ProgressLocation: { Notification: 15 },
  Uri: { parse: (url: string) => ({ toString: () => url }) },
  env: { openExternal: (...args: unknown[]) => mockOpenExternal(...args) },
  window: {
    withProgress: (
      _opts: unknown,
      task: (progress: { report: typeof mockReport }) => Promise<void>,
    ) => task({ report: mockReport }),
    showInformationMessage: (...args: unknown[]) =>
      mockShowInformationMessage(...args),
    showErrorMessage: (...args: unknown[]) => mockShowErrorMessage(...args),
  },
}));

function makeCallbacks() {
  const calls: string[] = [];
  let failureMessage: string | undefined;
  return {
    get calls() {
      return calls;
    },
    get failureMessage() {
      return failureMessage;
    },
    onStart: () => calls.push("start"),
    onSuccess: () => calls.push("success"),
    onFailure: (msg: string) => {
      calls.push("failure");
      failureMessage = msg;
    },
    onComplete: () => calls.push("complete"),
  };
}

const successResult: PublishResult = {
  contentId: "abc-123",
  dashboardUrl: "https://connect.example.com/content/abc-123",
  directUrl: "https://connect.example.com/content/abc-123/",
  logsUrl: "https://connect.example.com/content/abc-123/logs",
  bundleId: "42",
};

describe("runTsDeployWithProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls lifecycle callbacks in order on success", async () => {
    const callbacks = makeCallbacks();

    runTsDeployWithProgress(() => Promise.resolve(successResult), callbacks);

    await vi.waitFor(() => {
      expect(callbacks.calls).toEqual(["start", "success", "complete"]);
    });
  });

  it("calls onFailure on deployment error", async () => {
    const callbacks = makeCallbacks();

    runTsDeployWithProgress(
      () => Promise.reject(new Error("Connection refused")),
      callbacks,
    );

    await vi.waitFor(() => {
      expect(callbacks.calls).toEqual(["start", "failure", "complete"]);
      expect(callbacks.failureMessage).toBe("Connection refused");
    });
  });

  it("reports step labels as progress messages", async () => {
    const callbacks = makeCallbacks();

    runTsDeployWithProgress((onProgress) => {
      onProgress({ step: "preflight", status: "start" });
      onProgress({ step: "uploadBundle", status: "start" });
      return Promise.resolve(successResult);
    }, callbacks);

    await vi.waitFor(() => {
      expect(mockReport).toHaveBeenCalledWith({
        message: "Verifying credentials…",
      });
      expect(mockReport).toHaveBeenCalledWith({
        message: "Uploading bundle…",
      });
    });
  });

  it("ignores progress events in the notification", async () => {
    const callbacks = makeCallbacks();

    runTsDeployWithProgress((onProgress) => {
      onProgress({
        step: "waitForTask",
        status: "progress",
        message: "Building Python environment",
      });
      return Promise.resolve(successResult);
    }, callbacks);

    await vi.waitFor(() => {
      expect(callbacks.calls).toContain("success");
    });

    expect(mockReport).not.toHaveBeenCalledWith({
      message: "Building Python environment",
    });
  });

  it("shows error message on failure", async () => {
    const callbacks = makeCallbacks();

    runTsDeployWithProgress(
      () => Promise.reject(new Error("upload failed")),
      callbacks,
    );

    await vi.waitFor(() => {
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Deployment failed: upload failed",
      );
    });
  });

  it("offers View button on success", async () => {
    const callbacks = makeCallbacks();
    mockShowInformationMessage.mockResolvedValueOnce("View");

    runTsDeployWithProgress(() => Promise.resolve(successResult), callbacks);

    await vi.waitFor(() => {
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        "Deployment was successful",
        "View",
      );
      expect(mockOpenExternal).toHaveBeenCalled();
    });
  });

  it("always calls onComplete even on failure", async () => {
    const callbacks = makeCallbacks();

    runTsDeployWithProgress(() => Promise.reject(new Error("boom")), callbacks);

    await vi.waitFor(() => {
      expect(callbacks.calls).toContain("complete");
    });
  });
});
