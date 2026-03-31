// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublishResult } from "src/publish/connectPublish";
import type { EventStreamMessage } from "src/api";
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

function makeMockStream() {
  const injected: EventStreamMessage[] = [];
  return {
    injected,
    injectMessage: (msg: EventStreamMessage) => {
      injected.push(msg);
    },
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

  function run(
    deploy: Parameters<typeof runTsDeployWithProgress>[0]["deploy"],
    overrides: Partial<Parameters<typeof runTsDeployWithProgress>[0]> = {},
  ) {
    const onComplete = vi.fn();
    const stream = makeMockStream();
    runTsDeployWithProgress({
      deploy,
      onComplete,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stream: stream as any,
      serverUrl: "https://connect.example.com",
      title: "my-app",
      ...overrides,
    });
    return { onComplete, stream };
  }

  it("calls onComplete on success", async () => {
    const { onComplete } = run(() => Promise.resolve(successResult));

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("calls onComplete on failure", async () => {
    const { onComplete } = run(() =>
      Promise.reject(new Error("Connection refused")),
    );

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("reports step labels as progress messages", async () => {
    run((onProgress) => {
      onProgress({ step: "preflight", status: "start" });
      onProgress({ step: "uploadBundle", status: "start" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(mockReport).toHaveBeenCalledWith({
        message: "Verifying credentials…",
      });
      expect(mockReport).toHaveBeenCalledWith({
        message: "Uploading bundle…",
      });
    });
  });

  it("ignores log events in the notification bar", async () => {
    const { onComplete } = run((onProgress) => {
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Building Python environment",
      });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    expect(mockReport).not.toHaveBeenCalledWith({
      message: "Building Python environment",
    });
  });

  it("shows error message on failure", async () => {
    run(() => Promise.reject(new Error("upload failed")));

    await vi.waitFor(() => {
      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        "Deployment failed: upload failed",
      );
    });
  });

  it("offers View button on success", async () => {
    mockShowInformationMessage.mockResolvedValueOnce("View");

    run(() => Promise.resolve(successResult));

    await vi.waitFor(() => {
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        "Deployment was successful",
        "View",
      );
      expect(mockOpenExternal).toHaveBeenCalled();
    });
  });

  // --- Event stream injection tests ---

  it("injects publish/start at the beginning", async () => {
    const { onComplete, stream } = run(() => Promise.resolve(successResult));

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const startMsg = stream.injected.find((m) => m.type === "publish/start");
    expect(startMsg).toBeDefined();
    expect(startMsg!.data.server).toBe("https://connect.example.com");
    expect(startMsg!.data.title).toBe("my-app");
  });

  it("injects stage start/success events for mapped steps", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "preflight", status: "start" });
      onProgress({ step: "preflight", status: "success" });
      onProgress({ step: "createBundle", status: "start" });
      onProgress({ step: "createBundle", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const types = stream.injected.map((m) => m.type);
    expect(types).toContain("publish/checkCapabilities/start");
    expect(types).toContain("publish/checkCapabilities/success");
    expect(types).toContain("publish/createBundle/start");
    expect(types).toContain("publish/createBundle/success");
  });

  it("injects log events from waitForTask as publish/restoreEnv/log", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Installing numpy",
      });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Installing pandas",
      });
      onProgress({ step: "waitForTask", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const logMsgs = stream.injected.filter(
      (m) => m.type === "publish/restoreEnv/log",
    );
    expect(logMsgs).toHaveLength(2);
    expect(logMsgs[0]!.data.message).toBe("Installing numpy");
    expect(logMsgs[1]!.data.message).toBe("Installing pandas");
  });

  it("transitions from restoreEnv to runContent on launch pattern", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Installing numpy",
      });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Launching Jupyter notebook",
      });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Activating kernel",
      });
      onProgress({ step: "waitForTask", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const types = stream.injected.map((m) => m.type);

    // restoreEnv gets the first log, then closes
    const restoreLogs = stream.injected.filter(
      (m) => m.type === "publish/restoreEnv/log",
    );
    expect(restoreLogs).toHaveLength(1);
    expect(restoreLogs[0]!.data.message).toBe("Installing numpy");
    expect(types).toContain("publish/restoreEnv/success");

    // runContent opens and gets the remaining logs
    expect(types).toContain("publish/runContent/start");
    const runLogs = stream.injected.filter(
      (m) => m.type === "publish/runContent/log",
    );
    expect(runLogs).toHaveLength(2);
    expect(runLogs[0]!.data.message).toBe("Launching Jupyter notebook");
    expect(runLogs[1]!.data.message).toBe("Activating kernel");

    // runContent closes (not restoreEnv again)
    expect(types).toContain("publish/runContent/success");
  });

  it("transitions on static content pattern", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Building static content",
      });
      onProgress({ step: "waitForTask", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const types = stream.injected.map((m) => m.type);
    expect(types).toContain("publish/runContent/start");
    expect(types).toContain("publish/runContent/success");
  });

  it("does not inject events for unmapped steps like createManifest", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "createManifest", status: "start" });
      onProgress({ step: "createManifest", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const types = stream.injected.map((m) => m.type);
    expect(types).not.toContain("publish/createManifest/start");
  });

  it("injects publish/success on successful deploy", async () => {
    const { onComplete, stream } = run(() => Promise.resolve(successResult));

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const successMsg = stream.injected.find(
      (m) => m.type === "publish/success",
    );
    expect(successMsg).toBeDefined();
    expect(successMsg!.data.dashboardUrl).toBe(successResult.dashboardUrl);
  });

  it("injects publish/failure on deploy error", async () => {
    const { onComplete, stream } = run(() =>
      Promise.reject(new Error("server error")),
    );

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const failMsg = stream.injected.find((m) => m.type === "publish/failure");
    expect(failMsg).toBeDefined();
    expect(failMsg!.data.message).toBe("server error");
  });

  it("injects stage failure event when a step fails", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "uploadBundle", status: "start" });
      onProgress({
        step: "uploadBundle",
        status: "failure",
        message: "413 too large",
      });
      return Promise.reject(new Error("413 too large"));
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const failMsg = stream.injected.find(
      (m) => m.type === "publish/uploadBundle/failure",
    );
    expect(failMsg).toBeDefined();
    expect(failMsg!.data.message).toBe("413 too large");
  });
});
