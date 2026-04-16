// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublishResult } from "src/publish/publishShared";
import type { EventStreamMessage } from "src/api";
import { isServerLogStep, runDeployWithProgress } from "./deployProgress";

vi.mock("src/logging");

// Mock vscode module
const mockReport = vi.fn();
const mockShowInformationMessage = vi.fn().mockResolvedValue(undefined);
const mockShowErrorMessage = vi.fn();
const mockOpenExternal = vi.fn();

let capturedCancellationHandler: (() => void) | undefined;
let mockCancellable: boolean | undefined;

vi.mock("vscode", () => ({
  ProgressLocation: { Notification: 15 },
  Uri: { parse: (url: string) => ({ toString: () => url }) },
  env: { openExternal: (...args: unknown[]) => mockOpenExternal(...args) },
  window: {
    withProgress: (
      opts: { cancellable?: boolean },
      task: (
        progress: { report: typeof mockReport },
        token: { onCancellationRequested: (cb: () => void) => void },
      ) => Promise<void>,
    ) => {
      mockCancellable = opts.cancellable;
      const token = {
        onCancellationRequested: (cb: () => void) => {
          capturedCancellationHandler = cb;
        },
      };
      return task({ report: mockReport }, token);
    },
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

describe("runDeployWithProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCancellationHandler = undefined;
    mockCancellable = undefined;
  });

  function run(
    deploy: Parameters<typeof runDeployWithProgress>[0]["deploy"],
    overrides: Partial<Parameters<typeof runDeployWithProgress>[0]> = {},
  ) {
    const onComplete = vi.fn();
    const stream = makeMockStream();
    runDeployWithProgress({
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

  it("injects publish/failure with message on deploy error", async () => {
    const { onComplete, stream } = run(() =>
      Promise.reject(new Error("upload failed")),
    );

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const failMsg = stream.injected.find((m) => m.type === "publish/failure");
    expect(failMsg).toBeDefined();
    expect(failMsg!.data.message).toBe("upload failed");
    expect(failMsg!.data.productType).toBe("connect");
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
    const restoreSuccessIdx = types.indexOf("publish/restoreEnv/success");
    const runStartIdx = types.indexOf("publish/runContent/start");
    const runSuccessIdx = types.indexOf("publish/runContent/success");

    expect(restoreSuccessIdx).toBeGreaterThan(-1);
    expect(runStartIdx).toBe(restoreSuccessIdx + 1);
    expect(runSuccessIdx).toBeGreaterThan(runStartIdx);
  });

  it("maps createManifest events to publish/getRPackageDescriptions", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "createManifest", status: "start" });
      onProgress({
        step: "createManifest",
        status: "log",
        message: "Scanning packages",
      });
      onProgress({ step: "createManifest", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const types = stream.injected.map((m) => m.type);
    expect(types).toContain("publish/getRPackageDescriptions/start");
    expect(types).toContain("publish/getRPackageDescriptions/log");
    expect(types).toContain("publish/getRPackageDescriptions/success");
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

  it("includes URLs on publish/failure when step failure provides them", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "validateDeployment", status: "start" });
      onProgress({
        step: "validateDeployment",
        status: "failure",
        message: "Content not running",
        errCode: "deployedContentNotRunning",
        data: {
          logsUrl: "https://connect.example.com/connect/#/apps/abc-123/logs",
          dashboardUrl: "https://connect.example.com/connect/#/apps/abc-123",
          status: "502",
        },
      });
      return Promise.reject(new Error("Content not running"));
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const failMsg = stream.injected.find((m) => m.type === "publish/failure");
    expect(failMsg).toBeDefined();
    expect(failMsg!.data.logsUrl).toBe(
      "https://connect.example.com/connect/#/apps/abc-123/logs",
    );
    expect(failMsg!.data.dashboardUrl).toBe(
      "https://connect.example.com/connect/#/apps/abc-123",
    );
    // errCode and classified message propagate to publish/failure
    expect(failMsg!.errCode).toBe("deployedContentNotRunning");
    expect(failMsg!.data.message).toBe("Content not running");
  });

  it("emits runContent/failure when task fails after stage transition", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Launching Jupyter notebook",
      });
      onProgress({
        step: "waitForTask",
        status: "failure",
        message: "Application crashed on startup",
      });
      return Promise.reject(new Error("Application crashed on startup"));
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const types = stream.injected.map((m) => m.type);
    expect(types).toContain("publish/runContent/failure");
    expect(types).not.toContain("publish/restoreEnv/failure");

    const failMsg = stream.injected.find(
      (m) => m.type === "publish/runContent/failure",
    );
    expect(failMsg!.data.message).toBe("Application crashed on startup");
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

  it("passes event.data through to validateDeployment failure event", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "validateDeployment", status: "start" });
      onProgress({
        step: "validateDeployment",
        status: "failure",
        message: "Content not running",
        errCode: "deployedContentNotRunning",
        data: {
          logsUrl: "https://connect.example.com/connect/#/apps/abc-123/logs",
          status: "502",
        },
      });
      return Promise.reject(new Error("Content not running"));
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const failMsg = stream.injected.find(
      (m) => m.type === "publish/validateDeployment/failure",
    );
    expect(failMsg).toBeDefined();
    expect(failMsg!.data.message).toBe("Content not running");
    expect(failMsg!.data.logsUrl).toBe(
      "https://connect.example.com/connect/#/apps/abc-123/logs",
    );
    expect(failMsg!.data.status).toBe("502");
    expect(failMsg!.errCode).toBe("deployedContentNotRunning");
  });

  it("passes event.data through on start events", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({
        step: "createBundle",
        status: "start",
        data: { sourceDir: "/projects/myapp" },
      });
      onProgress({ step: "createBundle", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const startMsg = stream.injected.find(
      (m) => m.type === "publish/createBundle/start",
    );
    expect(startMsg).toBeDefined();
    expect(startMsg!.data.sourceDir).toBe("/projects/myapp");
  });

  it("passes event.data through on success events", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "createBundle", status: "start" });
      onProgress({
        step: "createBundle",
        status: "success",
        data: { filename: "bundle.tar.gz" },
      });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const successMsg = stream.injected.find(
      (m) => m.type === "publish/createBundle/success",
    );
    expect(successMsg).toBeDefined();
    expect(successMsg!.data.filename).toBe("bundle.tar.gz");
  });

  it("maps createNewDeployment to publish/createNewDeployment", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({
        step: "createNewDeployment",
        status: "start",
        data: { saveName: "my-app" },
      });
      onProgress({
        step: "createNewDeployment",
        status: "log",
        message: "Creating new deployment",
      });
      onProgress({
        step: "createNewDeployment",
        status: "success",
        data: { contentId: "abc-123", saveName: "my-app" },
      });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const startMsg = stream.injected.find(
      (m) => m.type === "publish/createNewDeployment/start",
    );
    expect(startMsg).toBeDefined();
    expect(startMsg!.data.saveName).toBe("my-app");

    const logMsg = stream.injected.find(
      (m) => m.type === "publish/createNewDeployment/log",
    );
    expect(logMsg).toBeDefined();
    expect(logMsg!.data.message).toBe("Creating new deployment");

    const successMsg = stream.injected.find(
      (m) => m.type === "publish/createNewDeployment/success",
    );
    expect(successMsg).toBeDefined();
    expect(successMsg!.data.contentId).toBe("abc-123");
    expect(successMsg!.data.saveName).toBe("my-app");
  });

  it("includes logsUrl on publish/success event", async () => {
    const { onComplete, stream } = run(() => Promise.resolve(successResult));

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const successMsg = stream.injected.find(
      (m) => m.type === "publish/success",
    );
    expect(successMsg).toBeDefined();
    expect(successMsg!.data.logsUrl).toBe(successResult.logsUrl);
  });

  it("emits publish/restoreEnv/status for R package installation lines", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Installing ggplot2 (3.4.0) ...",
      });
      onProgress({ step: "waitForTask", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const statusMsgs = stream.injected.filter(
      (m) => m.type === "publish/restoreEnv/status",
    );
    expect(statusMsgs).toHaveLength(1);
    expect(statusMsgs[0]!.data.name).toBe("ggplot2");
    expect(statusMsgs[0]!.data.version).toBe("3.4.0");
    expect(statusMsgs[0]!.data.runtime).toBe("r");
  });

  it("emits publish/restoreEnv/status for Python package lines", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Collecting numpy==1.24.3",
      });
      onProgress({ step: "waitForTask", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const statusMsgs = stream.injected.filter(
      (m) => m.type === "publish/restoreEnv/status",
    );
    expect(statusMsgs).toHaveLength(1);
    expect(statusMsgs[0]!.data.name).toBe("numpy");
    expect(statusMsgs[0]!.data.version).toBe("1.24.3");
    expect(statusMsgs[0]!.data.runtime).toBe("python");
  });

  it("emits status with empty version for Python 'Found existing installation' lines", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Found existing installation: numpy 1.24.3",
      });
      onProgress({ step: "waitForTask", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const statusMsgs = stream.injected.filter(
      (m) => m.type === "publish/restoreEnv/status",
    );
    expect(statusMsgs).toHaveLength(1);
    expect(statusMsgs[0]!.data.name).toBe("numpy");
    // Version is intentionally empty — this line reports the OLD version
    // being replaced. The meaningful new version comes from "Collecting".
    expect(statusMsgs[0]!.data.version).toBe("");
    expect(statusMsgs[0]!.data.runtime).toBe("python");
    expect(statusMsgs[0]!.data.status).toBe("install");
  });

  it("does not emit status events for non-package log lines", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "waitForTask", status: "start" });
      onProgress({
        step: "waitForTask",
        status: "log",
        message: "Building Python environment",
      });
      onProgress({ step: "waitForTask", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const statusMsgs = stream.injected.filter((m) =>
      m.type.endsWith("/status"),
    );
    expect(statusMsgs).toHaveLength(0);
  });

  it("injects validateDeployment log events", async () => {
    const { onComplete, stream } = run((onProgress) => {
      onProgress({ step: "validateDeployment", status: "start" });
      onProgress({
        step: "validateDeployment",
        status: "log",
        message: "Testing URL /content/abc-123/",
        data: { url: "/content/abc-123/" },
      });
      onProgress({ step: "validateDeployment", status: "success" });
      return Promise.resolve(successResult);
    });

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const logMsgs = stream.injected.filter(
      (m) => m.type === "publish/validateDeployment/log",
    );
    expect(logMsgs).toHaveLength(1);
    expect(logMsgs[0]!.data.message).toBe("Testing URL /content/abc-123/");
    expect(logMsgs[0]!.data.url).toBe("/content/abc-123/");
  });

  describe("cancellation", () => {
    it("sets cancellable: true on the progress notification", async () => {
      run(() => Promise.resolve(successResult));

      await vi.waitFor(() => {
        expect(mockCancellable).toBe(true);
      });
    });

    it("injects publish/failure with canceled flag when user cancels", async () => {
      let deployResolve: (r: PublishResult) => void;
      const deployPromise = new Promise<PublishResult>((resolve) => {
        deployResolve = resolve;
      });

      const { stream } = run(() => deployPromise);

      // Simulate user clicking cancel
      capturedCancellationHandler?.();

      // Resolve the deploy so the async function completes
      deployResolve!(successResult);

      await vi.waitFor(() => {
        const failMsg = stream.injected.find(
          (m) => m.type === "publish/failure",
        );
        expect(failMsg).toBeDefined();
        expect(failMsg!.data.canceled).toBe("true");
        expect(failMsg!.data.message).toContain("dismissed");
      });
    });

    it("calls onCancel callback when user cancels", async () => {
      let deployResolve: (r: PublishResult) => void;
      const deployPromise = new Promise<PublishResult>((resolve) => {
        deployResolve = resolve;
      });

      const onCancel = vi.fn();
      run(() => deployPromise, { onCancel });

      capturedCancellationHandler?.();
      deployResolve!(successResult);

      await vi.waitFor(() => {
        expect(onCancel).toHaveBeenCalledOnce();
      });
    });

    it("does not inject publish/failure twice on CanceledError", async () => {
      const { CanceledError } = await import("src/publish/publishShared");

      const { stream } = run(() => Promise.reject(new CanceledError()));

      await vi.waitFor(() => {
        // The only publish/failure should be from the cancel handler (if it ran),
        // not from the catch block
        const failMsgs = stream.injected.filter(
          (m) => m.type === "publish/failure",
        );
        // CanceledError alone (no cancel handler) should produce zero failure events
        expect(failMsgs).toHaveLength(0);
      });
    });
  });

  // --- Cloud-specific step tests ---

  describe("Cloud publish steps", () => {
    it("maps createContent to publish/createNewDeployment", async () => {
      const { onComplete, stream } = run((onProgress) => {
        onProgress({
          step: "createContent",
          status: "start",
          data: { saveName: "my-cloud-app" },
        });
        onProgress({
          step: "createContent",
          status: "log",
          message: "Creating new Connect Cloud deployment",
        });
        onProgress({
          step: "createContent",
          status: "success",
          data: { contentId: "cloud-123", saveName: "my-cloud-app" },
        });
        return Promise.resolve(successResult);
      });

      await vi.waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      const types = stream.injected.map((m) => m.type);
      expect(types).toContain("publish/createNewDeployment/start");
      expect(types).toContain("publish/createNewDeployment/log");
      expect(types).toContain("publish/createNewDeployment/success");
    });

    it("maps initiatePublish to publish/deployBundle", async () => {
      const { onComplete, stream } = run((onProgress) => {
        onProgress({ step: "initiatePublish", status: "start" });
        onProgress({ step: "initiatePublish", status: "success" });
        return Promise.resolve(successResult);
      });

      await vi.waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      const types = stream.injected.map((m) => m.type);
      expect(types).toContain("publish/deployBundle/start");
      expect(types).toContain("publish/deployBundle/success");
    });

    it("starts restoreEnv on watchLogs start event", async () => {
      const { onComplete, stream } = run((onProgress) => {
        onProgress({ step: "watchLogs", status: "start" });
        onProgress({
          step: "watchLogs",
          status: "log",
          message: "Building application",
        });
        onProgress({
          step: "watchLogs",
          status: "log",
          message: "Installing packages",
        });
        onProgress({ step: "watchLogs", status: "success" });
        return Promise.resolve(successResult);
      });

      await vi.waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      const types = stream.injected.map((m) => m.type);
      expect(types).toContain("publish/restoreEnv/start");
      const logMsgs = stream.injected.filter(
        (m) => m.type === "publish/restoreEnv/log",
      );
      expect(logMsgs).toHaveLength(2);
      expect(logMsgs[0]!.data.message).toBe("Building application");
      expect(logMsgs[1]!.data.message).toBe("Installing packages");
      expect(types).toContain("publish/restoreEnv/success");
    });

    it("transitions watchLogs from restoreEnv to runContent on launch pattern", async () => {
      const { onComplete, stream } = run((onProgress) => {
        onProgress({ step: "watchLogs", status: "start" });
        onProgress({
          step: "watchLogs",
          status: "log",
          message: "Installing numpy",
        });
        onProgress({
          step: "watchLogs",
          status: "log",
          message: "Launching Shiny application",
        });
        onProgress({
          step: "watchLogs",
          status: "log",
          message: "Application started",
        });
        onProgress({ step: "watchLogs", status: "success" });
        return Promise.resolve(successResult);
      });

      await vi.waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      const types = stream.injected.map((m) => m.type);

      // restoreEnv gets the first log, then transitions
      const restoreLogs = stream.injected.filter(
        (m) => m.type === "publish/restoreEnv/log",
      );
      expect(restoreLogs).toHaveLength(1);
      expect(restoreLogs[0]!.data.message).toBe("Installing numpy");
      expect(types).toContain("publish/restoreEnv/success");

      // runContent gets the launch line and subsequent logs
      expect(types).toContain("publish/runContent/start");
      const runLogs = stream.injected.filter(
        (m) => m.type === "publish/runContent/log",
      );
      expect(runLogs).toHaveLength(2);

      // runContent closed by explicit success event
      expect(types).toContain("publish/runContent/success");
    });

    it("handles awaitCompletion log events in the active server log stage", async () => {
      const { onComplete, stream } = run((onProgress) => {
        onProgress({ step: "watchLogs", status: "start" });
        onProgress({
          step: "watchLogs",
          status: "log",
          message: "Building app",
        });
        // awaitCompletion runs concurrently with watchLogs
        onProgress({
          step: "awaitCompletion",
          status: "log",
          message: "Waiting for publish to complete",
        });
        onProgress({ step: "watchLogs", status: "success" });
        return Promise.resolve(successResult);
      });

      await vi.waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      // Both watchLogs and awaitCompletion log messages go to the active stage
      const logMsgs = stream.injected.filter(
        (m) => m.type === "publish/restoreEnv/log",
      );
      expect(logMsgs).toHaveLength(2);
      expect(logMsgs[0]!.data.message).toBe("Building app");
      expect(logMsgs[1]!.data.message).toBe("Waiting for publish to complete");
      // Phase explicitly closed
      const types = stream.injected.map((m) => m.type);
      expect(types).toContain("publish/restoreEnv/success");
    });

    it("detects package installations in watchLogs events", async () => {
      const { onComplete, stream } = run((onProgress) => {
        onProgress({ step: "watchLogs", status: "start" });
        onProgress({
          step: "watchLogs",
          status: "log",
          message: "Collecting numpy==1.24.3",
        });
        onProgress({ step: "watchLogs", status: "success" });
        return Promise.resolve(successResult);
      });

      await vi.waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      const statusMsgs = stream.injected.filter(
        (m) => m.type === "publish/restoreEnv/status",
      );
      expect(statusMsgs).toHaveLength(1);
      expect(statusMsgs[0]!.data.name).toBe("numpy");
      expect(statusMsgs[0]!.data.version).toBe("1.24.3");
      expect(statusMsgs[0]!.data.runtime).toBe("python");
    });
  });
});

describe("isServerLogStep", () => {
  it("returns true for server log steps", () => {
    expect(isServerLogStep("waitForTask")).toBe(true);
    expect(isServerLogStep("watchLogs")).toBe(true);
    expect(isServerLogStep("awaitCompletion")).toBe(true);
  });

  it("returns false for non-server-log steps", () => {
    expect(isServerLogStep("createManifest")).toBe(false);
    expect(isServerLogStep("preflight")).toBe(false);
    expect(isServerLogStep("createNewDeployment")).toBe(false);
    expect(isServerLogStep("createDeployment")).toBe(false);
    expect(isServerLogStep("createBundle")).toBe(false);
    expect(isServerLogStep("uploadBundle")).toBe(false);
    expect(isServerLogStep("updateContent")).toBe(false);
    expect(isServerLogStep("setEnvVars")).toBe(false);
    expect(isServerLogStep("deployBundle")).toBe(false);
    expect(isServerLogStep("validateDeployment")).toBe(false);
    // Cloud-specific non-server-log steps
    expect(isServerLogStep("createContent")).toBe(false);
    expect(isServerLogStep("initiatePublish")).toBe(false);
  });
});
