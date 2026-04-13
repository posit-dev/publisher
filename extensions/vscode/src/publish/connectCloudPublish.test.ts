// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import {
  connectCloudPublish,
  type ConnectCloudPublishOptions,
  type CloudPublishEvent,
  type CloudPublishStep,
} from "./connectCloudPublish";

import { CanceledError } from "./publishShared";
import { ContentType } from "../api/types/configurations";
import type { ConfigurationDetails } from "../api/types/configurations";
import { ProductType, ServerType } from "../api/types/contentRecords";

import type {
  ConnectCloudAPI,
  ContentResponse,
  Revision,
  CreateContentRequest,
  UpdateContentRequest,
} from "@posit-dev/connect-cloud-api";
import {
  CloudEnvironment,
  ContentAccess,
  ContentID,
  PublishResult as CloudPublishResult,
} from "@posit-dev/connect-cloud-api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("{}"),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn(),
}));

// Mock the bundler
vi.mock("../bundler/bundler", () => ({
  createBundle: vi.fn().mockImplementation((options) => {
    if (options.onProgress) {
      options.onProgress({ kind: "summary", files: 1, totalBytes: 100 });
    }
    return Promise.resolve({
      bundle: Buffer.from("fake-bundle"),
      manifest: {
        version: 1,
        metadata: { appmode: "python-shiny" },
        packages: {},
        files: { "app.py": { checksum: "abc" } },
      },
      fileCount: 1,
      totalSize: 100,
    });
  }),
}));

vi.mock("../logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./dependencies", () => ({
  resolveRPackages: vi.fn().mockResolvedValue(undefined),
  readPythonRequirements: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./extraDependencies", () => ({
  findExtraDependencies: vi.fn().mockResolvedValue([]),
  recordExtraDependencies: vi.fn().mockResolvedValue(null),
  cleanupExtraDependencies: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../interpreters/rPackages", () => ({
  scanRPackages: vi.fn().mockResolvedValue(undefined),
  repoURLFromOptions: vi.fn().mockReturnValue(""),
}));

vi.mock("../interpreters/fsUtils", () => ({
  fileExistsAt: vi.fn().mockResolvedValue(false),
}));

vi.mock("../interpreters/pythonDependencySources", () => ({
  generateRequirements: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("smol-toml", () => ({
  stringify: vi.fn().mockImplementation((obj: unknown) => JSON.stringify(obj)),
}));

vi.mock("../toml/configCompliance", () => ({
  forceProductTypeCompliance: vi.fn(),
}));

// Mock watchCloudLogs - DO NOT mock the entire @posit-dev/connect-cloud-api
// Instead, mock just the watchCloudLogs function
vi.mock("@posit-dev/connect-cloud-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@posit-dev/connect-cloud-api")>();
  return {
    ...actual,
    watchCloudLogs: vi.fn().mockResolvedValue(undefined),
  };
});

const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  overrides?: Partial<ConfigurationDetails>,
): ConfigurationDetails {
  return {
    $schema:
      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
    productType: ProductType.CONNECT_CLOUD,
    type: ContentType.PYTHON_SHINY,
    entrypoint: "app.py",
    files: ["app.py"],
    validate: false,
    ...overrides,
  };
}

function createMockApi(): ConnectCloudAPI {
  const contentResponse: ContentResponse = {
    id: ContentID("content-123"),
    access: ContentAccess.ViewPrivateEditPrivate,
    next_revision: {
      id: "rev-1",
      publish_log_channel: "log-channel-1",
      publish_result: null,
      source_bundle_id: "bundle-456",
      source_bundle_upload_url: "https://s3.example.com/upload",
    },
  };

  return {
    createContent: vi.fn().mockResolvedValue(contentResponse),
    updateContent: vi.fn().mockResolvedValue(contentResponse),
    uploadBundle: vi.fn().mockResolvedValue(undefined),
    publishContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(contentResponse),
    getRevision: vi.fn().mockResolvedValue({
      id: "rev-1",
      publish_result: CloudPublishResult.Success,
    } as Revision),
    getAuthorization: vi.fn().mockResolvedValue({
      authorized: true,
      token: "log-token-123",
    }),
    getAccount: vi.fn().mockResolvedValue({
      license: {
        entitlements: { account_private_content_flag: { enabled: true } },
      },
    }),
  } as unknown as ConnectCloudAPI;
}

function baseOptions(
  overrides?: Partial<ConnectCloudPublishOptions>,
): ConnectCloudPublishOptions {
  return {
    api: createMockApi(),
    projectDir: path.join("/", "test", "project"),
    saveName: "my-deploy",
    config: makeConfig(),
    configName: "default",
    serverType: ServerType.CONNECT_CLOUD,
    credential: {
      accountId: "acct-1",
      accountName: "my-account",
      environment: CloudEnvironment.Production,
    },
    clientVersion: "1.0.0",
    onProgress: vi.fn(),
    ...overrides,
  };
}

function progressSteps(
  onProgress: ReturnType<typeof vi.fn>,
): Array<{ step: CloudPublishStep; status: string }> {
  return onProgress.mock.calls.map((args: unknown[]) => {
    const evt = args[0] as CloudPublishEvent;
    return { step: evt.step, status: evt.status };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("connectCloudPublish", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("happy path — first deploy", async () => {
    const opts = baseOptions();
    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Verify result
    expect(result.contentId).toBe("content-123");
    expect(result.bundleId).toBe("bundle-456");
    expect(result.dashboardUrl).toContain("connect.posit.cloud");
    expect(result.directUrl).toContain("connect.posit.cloud");

    // Verify API call sequence
    const api = opts.api;
    expect(api.createContent).toHaveBeenCalledOnce();
    expect(api.updateContent).not.toHaveBeenCalled();
    expect(api.publishContent).toHaveBeenCalledOnce();
    expect(api.uploadBundle).toHaveBeenCalledOnce();
    expect(api.getRevision).toHaveBeenCalledOnce();
  });

  test("happy path — redeploy", async () => {
    const opts = baseOptions({
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.contentId).toBe("existing-id");

    // Should NOT create new content
    expect(opts.api.createContent).not.toHaveBeenCalled();

    // Should update existing content
    expect(opts.api.updateContent).toHaveBeenCalledOnce();
    expect(opts.api.publishContent).toHaveBeenCalledOnce();
    expect(opts.api.uploadBundle).toHaveBeenCalledOnce();
  });

  test("revision failure throws with error details", async () => {
    const api = createMockApi();
    vi.mocked(api.getRevision).mockResolvedValue({
      id: "rev-1",
      publish_result: CloudPublishResult.Failure,
      publish_error: "BuildError",
      publish_error_details: "Package 'flask' not found",
    } as Revision);

    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow(
      "BuildError: Package 'flask' not found",
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  test("cancellation throws CanceledError", async () => {
    const opts = baseOptions({ signal: AbortSignal.abort() });

    await expect(connectCloudPublish(opts)).rejects.toThrow(CanceledError);
  });

  test("emits progress events for each step", async () => {
    const onProgress = vi.fn();
    const opts = baseOptions({ onProgress });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    const steps = progressSteps(onProgress);
    const startSteps = steps.filter((s) => s.status === "start");
    const stepNames = startSteps.map((s) => s.step);

    expect(stepNames).toContain("createManifest");
    expect(stepNames).toContain("createBundle");
    expect(stepNames).toContain("createContent");
    expect(stepNames).toContain("initiatePublish");
    expect(stepNames).toContain("uploadBundle");
    // Note: awaitCompletion doesn't emit a "start" event, only log events
  });

  test("writes deployment record after content creation", async () => {
    const opts = baseOptions({
      projectDir: path.join("/", "projects", "myapp"),
      saveName: "staging",
    });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    const expectedDir = path.join(
      "/",
      "projects",
      "myapp",
      ".posit",
      "publish",
      "deployments",
    );

    // mkdir should have been called to ensure directory exists
    expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });

    // writeFile should have been called for the deployment record
    const writeCalls = mockWriteFile.mock.calls.filter(
      ([p]) => typeof p === "string" && p.endsWith("staging.toml"),
    );
    expect(writeCalls.length).toBeGreaterThanOrEqual(1);

    // Verify content ID is in the record
    const lastWrite = writeCalls[writeCalls.length - 1];
    expect(lastWrite).toBeDefined();
    const content = lastWrite![1] as string;
    expect(content).toContain("content-123");
  });

  test("step order: initiatePublish before uploadBundle", async () => {
    const api = createMockApi();
    const callOrder: string[] = [];

    vi.mocked(api.publishContent).mockImplementation(() => {
      callOrder.push("publishContent");
      return Promise.resolve();
    });

    vi.mocked(api.uploadBundle).mockImplementation(() => {
      callOrder.push("uploadBundle");
      return Promise.resolve();
    });

    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(callOrder).toEqual(["publishContent", "uploadBundle"]);
  });

  test("first deploy uses createContent step", async () => {
    const onProgress = vi.fn();
    const opts = baseOptions({ onProgress });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    const steps = progressSteps(onProgress);
    expect(steps.find((s) => s.step === "createContent")).toBeDefined();
    expect(steps.find((s) => s.step === "updateContent")).toBeUndefined();
  });

  test("redeploy uses updateContent step", async () => {
    const onProgress = vi.fn();
    const opts = baseOptions({
      onProgress,
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    const steps = progressSteps(onProgress);
    expect(steps.find((s) => s.step === "updateContent")).toBeDefined();
    expect(steps.find((s) => s.step === "createContent")).toBeUndefined();
  });

  test("calls getAccess with create flag for first deploy", async () => {
    const api = createMockApi();
    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    // createContent should be called with access from getAccess
    expect(api.createContent).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: "acct-1" }),
    );
  });

  test("passes secrets to createContent", async () => {
    const api = createMockApi();
    const opts = baseOptions({
      api,
      secrets: { API_KEY: "secret123" },
    });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(api.createContent).toHaveBeenCalledWith(
      expect.objectContaining({
        secrets: expect.arrayContaining([
          expect.objectContaining({ name: "API_KEY", value: "secret123" }),
        ]),
      }) as CreateContentRequest,
    );
  });

  test("passes secrets to updateContent", async () => {
    const api = createMockApi();
    const opts = baseOptions({
      api,
      existingContentId: "existing-id",
      secrets: { API_KEY: "secret123" },
    });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(api.updateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        secrets: expect.arrayContaining([
          expect.objectContaining({ name: "API_KEY", value: "secret123" }),
        ]),
      }) as UpdateContentRequest,
    );
  });

  test("uploads bundle to pre-signed S3 URL", async () => {
    const api = createMockApi();
    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(api.uploadBundle).toHaveBeenCalledWith(
      "https://s3.example.com/upload",
      expect.any(Uint8Array),
    );
  });

  test("streams logs from log channel", async () => {
    const { watchCloudLogs } = await import("@posit-dev/connect-cloud-api");
    const onProgress = vi.fn();
    const opts = baseOptions({ onProgress });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    // watchCloudLogs should have been called
    expect(watchCloudLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: CloudEnvironment.Production,
        logChannel: "log-channel-1",
        authToken: "log-token-123",
      }),
    );

    // Verify onLog callback was provided
    const callArgs = vi.mocked(watchCloudLogs).mock.calls[0]![0];
    expect(callArgs.onLog).toBeDefined();
  });

  test("log messages are emitted via onProgress", async () => {
    const { watchCloudLogs } = await import("@posit-dev/connect-cloud-api");
    const onProgress = vi.fn();

    // Mock watchCloudLogs to invoke onLog callback
    vi.mocked(watchCloudLogs).mockImplementation(async (options) => {
      if (options.onLog) {
        options.onLog({ message: "Building application", level: "info" });
        options.onLog({ message: "Installing packages", level: "info" });
      }
    });

    const opts = baseOptions({ onProgress });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as CloudPublishEvent,
    );
    const logEvents = events.filter(
      (e) => e.step === "watchLogs" && e.status === "log",
    );

    expect(logEvents.map((e) => e.message)).toContain("Building application");
    expect(logEvents.map((e) => e.message)).toContain("Installing packages");
  });

  test("polls for revision completion", async () => {
    const api = createMockApi();
    let pollCount = 0;

    vi.mocked(api.getRevision).mockImplementation(async () => {
      pollCount++;
      if (pollCount < 3) {
        return {
          id: "rev-1",
          publish_result: null,
        } as Revision;
      }
      return {
        id: "rev-1",
        publish_result: CloudPublishResult.Success,
      } as Revision;
    });

    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(pollCount).toBe(3);
    expect(api.getRevision).toHaveBeenCalledTimes(3);
  });

  test("failure event includes error code and message", async () => {
    const api = createMockApi();
    vi.mocked(api.uploadBundle).mockRejectedValue(new Error("Upload failed"));

    const onProgress = vi.fn();
    const opts = baseOptions({ api, onProgress });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow("Upload failed");
    await vi.runAllTimersAsync();
    await assertion;

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as CloudPublishEvent,
    );
    const failureEvent = events.find((e) => e.status === "failure");

    expect(failureEvent).toBeDefined();
    expect(failureEvent!.step).toBe("uploadBundle");
    expect(failureEvent!.message).toBe("Upload failed");
    expect(failureEvent!.errCode).toBe("unknown");
  });

  test("401 error classifies as authFailedErr", async () => {
    const { AxiosError, AxiosHeaders } = await import("axios");
    const api = createMockApi();
    const axiosErr = new AxiosError(
      "Unauthorized",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 401,
        statusText: "Unauthorized",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );
    vi.mocked(api.createContent).mockRejectedValue(axiosErr);

    const onProgress = vi.fn();
    const opts = baseOptions({ api, onProgress });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as CloudPublishEvent,
    );
    const failureEvent = events.find((e) => e.status === "failure");

    expect(failureEvent).toBeDefined();
    expect(failureEvent!.errCode).toBe("authFailedErr");
  });

  test("revision failure classifies as deployFailed", async () => {
    const api = createMockApi();
    vi.mocked(api.getRevision).mockResolvedValue({
      id: "rev-1",
      publish_result: CloudPublishResult.Failure,
      publish_error: "BuildError",
      publish_error_details: "Package not found",
    } as Revision);

    const onProgress = vi.fn();
    const opts = baseOptions({ api, onProgress });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as CloudPublishEvent,
    );
    const failureEvent = events.find((e) => e.status === "failure");

    expect(failureEvent).toBeDefined();
    expect(failureEvent!.errCode).toBe("deployFailed");
  });

  test("writes deploymentError to record on failure", async () => {
    const api = createMockApi();
    vi.mocked(api.uploadBundle).mockRejectedValue(new Error("Upload failed"));

    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow("Upload failed");
    await vi.runAllTimersAsync();
    await assertion;

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("deployment_error");
    expect(tomlContent).toContain("Upload failed");
  });

  test("writes dismissedAt on cancellation", async () => {
    const opts = baseOptions({ signal: AbortSignal.abort() });

    try {
      await connectCloudPublish(opts);
    } catch {
      // expected
    }

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    const content = lastWrite![1] as string;
    expect(content).toContain("dismissed_at");
    expect(content).not.toContain("deployment_error");
  });

  test("does not mutate the caller's config", async () => {
    const config = makeConfig({ title: "Original Title" });
    const originalConfig = structuredClone(config);
    const opts = baseOptions({ config });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(config).toEqual(originalConfig);
  });

  test("includes logsUrl in failure event data", async () => {
    const api = createMockApi();
    vi.mocked(api.uploadBundle).mockRejectedValue(new Error("Upload failed"));

    const onProgress = vi.fn();
    const opts = baseOptions({
      api,
      onProgress,
      existingContentId: "existing-id",
    });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow("Upload failed");
    await vi.runAllTimersAsync();
    await assertion;

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as CloudPublishEvent,
    );
    const failureEvent = events.find((e) => e.status === "failure");

    expect(failureEvent).toBeDefined();
    expect(failureEvent!.data?.logsUrl).toBeDefined();
    expect(failureEvent!.data?.logsUrl).toContain("existing-id");
  });

  test("throws if not authorized to access log channel", async () => {
    const api = createMockApi();
    vi.mocked(api.getAuthorization).mockResolvedValue({
      authorized: false,
      token: undefined,
    });

    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow(
      "Not authorized to access log channel",
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  test("refetches content before watching logs", async () => {
    const api = createMockApi();
    const opts = baseOptions({ api });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    await resultPromise;

    // getContent should be called after uploadBundle to get fresh revision
    expect(api.getContent).toHaveBeenCalledWith("content-123");
  });

  test("uses environment URLs for dashboard and direct URLs", async () => {
    const opts = baseOptions({
      credential: {
        accountId: "acct-1",
        accountName: "my-account",
        environment: CloudEnvironment.Staging,
      },
    });

    const resultPromise = connectCloudPublish(opts);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.dashboardUrl).toContain("staging.connect.posit.cloud");
    expect(result.directUrl).toContain("staging.connect.posit.cloud");
  });

  test("cancellation during API call normalizes to CanceledError", async () => {
    const controller = new AbortController();
    const api = createMockApi();

    vi.mocked(api.uploadBundle).mockImplementation(() => {
      controller.abort();
      return Promise.reject(new Error("canceled"));
    });

    const opts = baseOptions({ api, signal: controller.signal });

    const resultPromise = connectCloudPublish(opts);
    const assertion = expect(resultPromise).rejects.toThrow(CanceledError);
    await vi.runAllTimersAsync();
    await assertion;

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    const content = lastWrite![1] as string;
    expect(content).toContain("dismissed_at");
    expect(content).not.toContain("deployment_error");
  });
});
