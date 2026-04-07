// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { writeFile, mkdir, copyFile, unlink } from "node:fs/promises";
import path from "node:path";

import {
  connectPublish,
  CancelledError,
  type ConnectPublishOptions,
  type PublishEvent,
  type PublishStep,
} from "./connectPublish";

import { ContentType } from "../api/types/configurations";
import type { ConfigurationDetails } from "../api/types/configurations";
import { ProductType, ServerType } from "../api/types/contentRecords";

import type {
  AllSettings,
  ConnectAPI,
  ContentDetailsDTO,
  BundleDTO,
  DeployOutput,
  TaskDTO,
  User,
} from "@posit-dev/connect-api";
import { AxiosError, AxiosHeaders } from "axios";

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
  createBundle: vi.fn().mockResolvedValue({
    bundle: Buffer.from("fake-bundle"),
    manifest: {
      version: 1,
      metadata: { appmode: "python-shiny" },
      packages: {},
      files: { "app.py": { checksum: "abc123" } },
    },
    fileCount: 1,
    totalSize: 100,
  }),
}));

// Mock the extension logger (depends on vscode)
vi.mock("../logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock dependencies
vi.mock("./dependencies", () => ({
  resolveRPackages: vi.fn().mockResolvedValue(undefined),
  readPythonRequirements: vi.fn().mockResolvedValue(undefined),
}));

// Mock extra dependencies
vi.mock("./extraDependencies", () => ({
  findExtraDependencies: vi.fn().mockResolvedValue([]),
  recordExtraDependencies: vi.fn().mockResolvedValue(null),
  cleanupExtraDependencies: vi.fn().mockResolvedValue(undefined),
}));

// Mock R scanning
vi.mock("../interpreters/rPackages", () => ({
  scanRPackages: vi.fn().mockResolvedValue(undefined),
  repoURLFromOptions: vi.fn().mockReturnValue(""),
}));

// Mock fsUtils — default to true so preflight requirements check passes
vi.mock("../interpreters/fsUtils", () => ({
  fileExistsAt: vi.fn().mockResolvedValue(true),
}));

// Mock TOML stringify — pass through to allow content inspection
vi.mock("smol-toml", () => ({
  stringify: vi.fn().mockImplementation((obj: unknown) => JSON.stringify(obj)),
}));

const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockCopyFile = vi.mocked(copyFile);
const mockUnlink = vi.mocked(unlink);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  overrides?: Partial<ConfigurationDetails>,
): ConfigurationDetails {
  return {
    $schema:
      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
    productType: ProductType.CONNECT,
    type: ContentType.PYTHON_SHINY,
    entrypoint: "app.py",
    files: ["app.py", "requirements.txt"],
    validate: false,
    python: {
      version: "3.11.0",
      packageFile: "requirements.txt",
      packageManager: "pip",
    },
    ...overrides,
  };
}

const TEST_USER: User = {
  id: "user-guid",
  username: "testuser",
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
};

const TEST_CONTENT: ContentDetailsDTO = {
  guid: "content-guid-123",
  name: "my-app",
  title: "My App",
  description: "",
  access_type: "acl",
  connection_timeout: null,
  read_timeout: null,
  init_timeout: null,
  idle_timeout: null,
  max_processes: null,
  min_processes: null,
  max_conns_per_process: null,
  load_factor: null,
  created_time: "2024-01-01T00:00:00Z",
  last_deployed_time: "2024-01-01T00:00:00Z",
  bundle_id: null,
  app_mode: "python-shiny",
  content_category: "",
  parameterized: false,
  cluster_name: null,
  image_name: null,
  r_version: null,
  py_version: "3.11.0",
  quarto_version: null,
  run_as: null,
  run_as_current_user: false,
  owner_guid: "user-guid",
  content_url: "https://connect.example.com/content/content-guid-123/",
  dashboard_url: "https://connect.example.com/connect/#/apps/content-guid-123",
  locked: false,
  app_role: "owner",
  id: "12345",
};

const TEST_BUNDLE: BundleDTO = {
  id: "bundle-42",
  content_guid: "content-guid-123",
  created_time: "2024-01-01T00:00:00Z",
  cluster_name: null,
  image_name: null,
  r_version: null,
  py_version: "3.11.0",
  quarto_version: null,
  active: false,
  size: 1024,
  metadata: {
    source: null,
    source_repo: null,
    source_branch: null,
    source_commit: null,
    archive_md5: null,
    archive_sha1: null,
  },
};

const TEST_DEPLOY_OUTPUT: DeployOutput = {
  task_id: "task-99",
};

/** Default server settings — all capabilities enabled, generous limits. */
function makeSettings(overrides?: Partial<AllSettings>): AllSettings {
  return {
    general: {
      license: {
        "allow-apis": true,
        "current-user-execution": true,
        "enable-launcher": true,
        "oauth-integrations": true,
      },
      runtimes: ["python", "r"],
      git_enabled: false,
      git_available: false,
      execution_type: "Kubernetes",
      enable_runtime_constraints: false,
      enable_image_management: false,
      default_image_selection_enabled: true,
      default_environment_management_selection: true,
      default_r_environment_management: true,
      default_py_environment_management: true,
      oauth_integrations_enabled: false,
      ...overrides?.general,
    },
    user: {
      guid: "user-guid",
      username: "testuser",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      user_role: "administrator",
      created_time: "2024-01-01T00:00:00Z",
      updated_time: "2024-01-01T00:00:00Z",
      active_time: null,
      confirmed: true,
      locked: false,
      ...overrides?.user,
    },
    application: {
      access_types: ["acl", "all", "logged_in"],
      run_as: "",
      run_as_group: "",
      run_as_current_user: true,
      ...overrides?.application,
    },
    scheduler: {
      min_processes: 0,
      max_processes: 3,
      max_conns_per_process: 20,
      load_factor: 0.5,
      init_timeout: 60,
      idle_timeout: 120,
      min_processes_limit: 10,
      max_processes_limit: 10,
      connection_timeout: 10,
      read_timeout: 30,
      cpu_request: 0.5,
      max_cpu_request: 8,
      cpu_limit: 2,
      max_cpu_limit: 16,
      memory_request: 256,
      max_memory_request: 8192,
      memory_limit: 1024,
      max_memory_limit: 16384,
      amd_gpu_limit: 0,
      max_amd_gpu_limit: 4,
      nvidia_gpu_limit: 0,
      max_nvidia_gpu_limit: 4,
      ...overrides?.scheduler,
    },
    python: { installations: [], api_enabled: true, ...overrides?.python },
    r: { installations: [], ...overrides?.r },
    quarto: { installations: [], ...overrides?.quarto },
  };
}

const TEST_TASK: TaskDTO = {
  id: "task-99",
  output: [],
  result: null,
  finished: true,
  code: 0,
  error: "",
  last: 0,
};

function makeMockApi(): ConnectAPI {
  return {
    testAuthentication: vi
      .fn()
      .mockResolvedValue({ user: TEST_USER, error: null }),
    createDeployment: vi.fn().mockResolvedValue({ data: TEST_CONTENT }),
    updateDeployment: vi.fn().mockResolvedValue(undefined),
    uploadBundle: vi.fn().mockResolvedValue({ data: TEST_BUNDLE }),
    deployBundle: vi.fn().mockResolvedValue({ data: TEST_DEPLOY_OUTPUT }),
    waitForTask: vi.fn().mockResolvedValue(TEST_TASK),
    validateDeployment: vi.fn().mockResolvedValue(undefined),
    setEnvVars: vi.fn().mockResolvedValue(undefined),
    getEnvVars: vi.fn(),
    contentDetails: vi.fn().mockResolvedValue({ data: TEST_CONTENT }),
    getCurrentUser: vi.fn(),
    getSettings: vi.fn().mockResolvedValue(makeSettings()),
    getIntegrations: vi.fn(),
    downloadBundle: vi.fn(),
  } as unknown as ConnectAPI;
}

function makeOptions(
  overrides?: Partial<ConnectPublishOptions>,
): ConnectPublishOptions {
  return {
    api: makeMockApi(),
    projectDir: "/projects/myapp",
    saveName: "production",
    config: makeConfig(),
    configName: "production",
    serverUrl: "https://connect.example.com",
    serverType: ServerType.CONNECT,
    clientVersion: "1.0.0",
    onProgress: vi.fn(),
    ...overrides,
  };
}

function progressSteps(
  onProgress: ReturnType<typeof vi.fn>,
): Array<{ step: PublishStep; status: string }> {
  return onProgress.mock.calls.map((args: unknown[]) => {
    const evt = args[0] as PublishEvent;
    return { step: evt.step, status: evt.status };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("connectPublish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("happy path — first deploy", async () => {
    const opts = makeOptions();
    const result = await connectPublish(opts);

    // Verify result
    expect(result.contentId).toBe("content-guid-123");
    expect(result.bundleId).toBe("bundle-42");
    expect(result.dashboardUrl).toBe(
      "https://connect.example.com/connect/#/apps/content-guid-123",
    );
    expect(result.directUrl).toBe(
      "https://connect.example.com/content/content-guid-123/",
    );

    // Verify API call sequence
    const api = opts.api;
    expect(api.testAuthentication).toHaveBeenCalledOnce();
    expect(api.createDeployment).toHaveBeenCalledWith({ name: "" }, undefined);
    expect(api.uploadBundle).toHaveBeenCalledOnce();
    expect(api.updateDeployment).toHaveBeenCalledOnce();
    expect(api.deployBundle).toHaveBeenCalledOnce();
    expect(api.waitForTask).toHaveBeenCalledOnce();

    // Validate should not have been called (config.validate = false)
    expect(api.validateDeployment).not.toHaveBeenCalled();
  });

  test("happy path — redeploy (existing content ID)", async () => {
    const opts = makeOptions({
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });

    const result = await connectPublish(opts);

    expect(result.contentId).toBe("existing-id");

    // Should NOT create a new deployment
    expect(opts.api.createDeployment).not.toHaveBeenCalled();

    // Should still upload, update, deploy
    expect(opts.api.uploadBundle).toHaveBeenCalledOnce();
    expect(opts.api.updateDeployment).toHaveBeenCalledOnce();
    expect(opts.api.deployBundle).toHaveBeenCalledOnce();
  });

  test("redeploy verifies existing content during preflight", async () => {
    const opts = makeOptions({
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });

    await connectPublish(opts);

    expect(opts.api.contentDetails).toHaveBeenCalledWith(
      expect.anything(), // ContentID branded type
      undefined, // signal
    );
  });

  test("redeploy rejects locked content", async () => {
    const opts = makeOptions({
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });
    vi.mocked(opts.api.contentDetails).mockResolvedValueOnce({
      data: { ...TEST_CONTENT, locked: true },
    } as never);

    await expect(connectPublish(opts)).rejects.toThrow(
      "Content is locked, cannot deploy to it",
    );
  });

  test("redeploy rejects app mode mismatch", async () => {
    const opts = makeOptions({
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });
    vi.mocked(opts.api.contentDetails).mockResolvedValueOnce({
      data: { ...TEST_CONTENT, app_mode: "shiny" },
    } as never);

    // Error shows the content type label, not the raw app mode
    await expect(connectPublish(opts)).rejects.toThrow(
      "Content was previously deployed as 'r-shiny'",
    );
  });

  test("redeploy allows unknown app mode on server", async () => {
    const opts = makeOptions({
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });
    vi.mocked(opts.api.contentDetails).mockResolvedValueOnce({
      data: { ...TEST_CONTENT, app_mode: "unknown" },
    } as never);

    // Should not throw — unknown mode is always allowed
    await connectPublish(opts);
  });

  test("redeploy allows empty app_mode on server", async () => {
    const opts = makeOptions({
      existingContentId: "existing-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });
    vi.mocked(opts.api.contentDetails).mockResolvedValueOnce({
      data: { ...TEST_CONTENT, app_mode: "" },
    } as never);

    // Empty string is Go's UnknownMode — should not throw
    await connectPublish(opts);
  });

  test("redeploy wraps contentDetails failure in friendly error", async () => {
    const opts = makeOptions({
      existingContentId: "deleted-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });
    vi.mocked(opts.api.contentDetails).mockRejectedValueOnce(
      new Error("Request failed with status code 404"),
    );

    // Plain Error (not AxiosError) → generic message with original error
    await expect(connectPublish(opts)).rejects.toThrow(
      "Cannot deploy content: ID deleted-id - Unknown error:",
    );
  });

  test("redeploy 404 gives specific content-not-found message", async () => {
    const opts = makeOptions({
      existingContentId: "deleted-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });
    const axiosErr = new AxiosError(
      "Not Found",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 404,
        statusText: "Not Found",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );
    vi.mocked(opts.api.contentDetails).mockRejectedValueOnce(axiosErr);

    await expect(connectPublish(opts)).rejects.toThrow(
      "Cannot deploy content: ID deleted-id - Content cannot be found.",
    );
  });

  test("redeploy 403 gives specific permissions message", async () => {
    const opts = makeOptions({
      existingContentId: "forbidden-id",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });
    const axiosErr = new AxiosError(
      "Forbidden",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 403,
        statusText: "Forbidden",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );
    vi.mocked(opts.api.contentDetails).mockRejectedValueOnce(axiosErr);

    await expect(connectPublish(opts)).rejects.toThrow(
      "Cannot deploy content: ID forbidden-id - You may need to request collaborator permissions",
    );
  });

  test("progress events are emitted in correct order", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress });

    await connectPublish(opts);

    const steps = progressSteps(onProgress);
    expect(steps).toEqual([
      { step: "createManifest", status: "start" },
      { step: "createManifest", status: "log" },
      { step: "createManifest", status: "log" },
      { step: "createManifest", status: "log" },
      { step: "createManifest", status: "log" },
      { step: "createManifest", status: "success" },
      { step: "preflight", status: "start" },
      { step: "preflight", status: "log" },
      { step: "preflight", status: "log" },
      { step: "preflight", status: "log" },
      { step: "preflight", status: "log" },
      { step: "preflight", status: "log" },
      { step: "preflight", status: "success" },
      { step: "createNewDeployment", status: "start" },
      { step: "createNewDeployment", status: "log" },
      { step: "createNewDeployment", status: "log" },
      { step: "createNewDeployment", status: "success" },
      { step: "createBundle", status: "start" },
      { step: "createBundle", status: "log" },
      { step: "createBundle", status: "log" },
      { step: "createBundle", status: "log" },
      { step: "createBundle", status: "log" },
      { step: "createBundle", status: "success" },
      { step: "uploadBundle", status: "start" },
      { step: "uploadBundle", status: "log" },
      { step: "uploadBundle", status: "log" },
      { step: "uploadBundle", status: "success" },
      { step: "updateContent", status: "start" },
      { step: "updateContent", status: "log" },
      { step: "updateContent", status: "log" },
      { step: "updateContent", status: "success" },
      { step: "deployBundle", status: "start" },
      { step: "deployBundle", status: "log" },
      { step: "deployBundle", status: "log" },
      { step: "deployBundle", status: "success" },
      { step: "waitForTask", status: "start" },
      { step: "waitForTask", status: "success" },
    ]);
  });

  test("env vars step included when secrets are provided", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({
      onProgress,
      secrets: { API_KEY: "secret123" },
    });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const envEvents = events.filter((e) => e.step === "setEnvVars");
    expect(envEvents.map((e) => e.status)).toEqual([
      "start",
      "log", // summary
      "log", // per-variable log
      "log", // done
      "success",
    ]);
    // Summary line before per-variable logs (matching Go)
    expect(envEvents[1]!.message).toBe("Setting environment variables");
    // Secret variables use "Setting secret as environment variable"
    expect(envEvents[2]!.message).toBe(
      "Setting secret as environment variable",
    );
    expect(envEvents[2]!.data).toEqual({ name: "API_KEY" });
    expect(envEvents[3]!.message).toBe("Done setting environment variables");

    expect(opts.api.setEnvVars).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ API_KEY: "secret123" }),
      undefined, // signal
    );
  });

  test("env vars merge config environment and secrets", async () => {
    const config = makeConfig({
      environment: { BASE_URL: "https://api.example.com" },
    });
    const opts = makeOptions({
      config,
      secrets: { API_KEY: "secret123" },
    });

    await connectPublish(opts);

    expect(opts.api.setEnvVars).toHaveBeenCalledWith(
      expect.anything(),
      {
        BASE_URL: "https://api.example.com",
        API_KEY: "secret123",
      },
      undefined, // signal
    );
  });

  test("env vars step skipped when no env vars or secrets", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress });

    await connectPublish(opts);

    const steps = progressSteps(onProgress);
    expect(steps.find((s) => s.step === "setEnvVars")).toBeUndefined();
    expect(opts.api.setEnvVars).not.toHaveBeenCalled();
  });

  test("validate step included when config.validate is true", async () => {
    const onProgress = vi.fn();
    const config = makeConfig({ validate: true });
    const opts = makeOptions({ onProgress, config });

    await connectPublish(opts);

    const steps = progressSteps(onProgress);
    expect(steps).toContainEqual({
      step: "validateDeployment",
      status: "start",
    });
    expect(steps).toContainEqual({
      step: "validateDeployment",
      status: "success",
    });
    expect(opts.api.validateDeployment).toHaveBeenCalledOnce();
  });

  test("deployment record is written to correct path", async () => {
    const opts = makeOptions({
      projectDir: "/projects/myapp",
      saveName: "staging",
    });

    await connectPublish(opts);

    const expectedDir = path.join(
      "/projects/myapp",
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
  });

  test("deployedAt is set on every record write including errors", async () => {
    const api = makeMockApi();
    (api.uploadBundle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("upload failed"),
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow("upload failed");

    // Every writeFile call to the deployment record should contain deployed_at
    const recordWrites = mockWriteFile.mock.calls.filter(
      ([p]) => typeof p === "string" && p.endsWith("production.toml"),
    );
    expect(recordWrites.length).toBeGreaterThanOrEqual(2); // initial + error
    for (const [, content] of recordWrites) {
      expect(content).toContain("deployed_at");
    }
  });

  test("auth failure propagates and records error", async () => {
    const api = makeMockApi();
    (api.testAuthentication as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Invalid API key"),
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow("Invalid API key");

    // Error should be written to deployment record
    const lastWrite = mockWriteFile.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    // Verify the error path writes to the deployment record file
    expect(lastWrite![0]).toContain("production.toml");
  });

  test("upload failure propagates and records error", async () => {
    const api = makeMockApi();
    (api.uploadBundle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Upload failed: 502"),
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow("Upload failed: 502");
  });

  test("deploy failure propagates", async () => {
    const api = makeMockApi();
    (api.waitForTask as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Build failed: missing package"),
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Build failed: missing package",
    );
  });

  test("does not mutate the caller's config", async () => {
    const config = makeConfig({ title: "Original Title" });
    const originalConfig = structuredClone(config);
    const opts = makeOptions({ config });

    await connectPublish(opts);

    expect(config).toEqual(originalConfig);
  });
});

describe("connectPublish — R package resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses existing lockfile when present", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(true);

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: { shiny: { description: { Package: "shiny" } } },
      lockfilePath: "/projects/myapp/renv.lock",
      lockfile: {
        R: {
          Version: "4.3.1",
          Repositories: [{ Name: "CRAN", URL: "https://cran.r-project.org" }],
        },
        Packages: {},
      },
    });

    const config = makeConfig({
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const opts = makeOptions({ config });

    await connectPublish(opts);

    // scanRPackages should NOT have been called (lockfile exists)
    const { scanRPackages } = await import("../interpreters/rPackages");
    expect(scanRPackages).not.toHaveBeenCalled();

    // resolveRPackages should have been called
    expect(resolveRPackages).toHaveBeenCalledWith(
      "/projects/myapp",
      expect.objectContaining({ packageFile: "renv.lock" }),
    );
  });

  test("existing lockfile path emits expected log messages", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(true);

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: { shiny: { description: { Package: "shiny" } } },
      lockfilePath: "/projects/myapp/renv.lock",
      lockfile: {
        R: { Version: "4.3.1", Repositories: [] },
        Packages: {},
      },
    });

    const config = makeConfig({
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const onProgress = vi.fn();
    const opts = makeOptions({ config, onProgress });

    await connectPublish(opts);

    const manifestLogs = onProgress.mock.calls
      .map((args: unknown[]) => args[0] as PublishEvent)
      .filter((e) => e.step === "createManifest" && e.status === "log");

    const messages = manifestLogs.map((e) => e.message);
    expect(messages).toContain("Loading packages from renv.lock");
    expect(messages).toContain("Done collecting R package descriptions");
    // Should NOT contain scan messages
    expect(messages).not.toContain(
      "No renv.lock found; automatically scanning for dependencies",
    );
    expect(messages).not.toContain("Detect dependencies from project");
  });

  test("no-lockfile scan path emits expected log messages", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: {},
      lockfilePath: "/projects/myapp/renv.lock",
      lockfile: {
        R: { Version: "4.3.1", Repositories: [] },
        Packages: {},
      },
    });

    const config = makeConfig({
      python: undefined,
      type: ContentType.RMD,
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const onProgress = vi.fn();
    const opts = makeOptions({ config, rPath: "/usr/bin/R", onProgress });

    await connectPublish(opts);

    const manifestLogs = onProgress.mock.calls
      .map((args: unknown[]) => args[0] as PublishEvent)
      .filter((e) => e.step === "createManifest" && e.status === "log");

    const messages = manifestLogs.map((e) => e.message);
    // R-specific messages appear in order among other createManifest logs
    const rMessages = messages.filter(
      (m) =>
        m?.includes("renv.lock") ||
        m?.includes("Detect dependencies") ||
        m?.includes("R package descriptions"),
    );
    expect(rMessages).toEqual([
      "No renv.lock found; automatically scanning for dependencies",
      "Detect dependencies from project",
      "Loading packages from renv.lock",
      "Done collecting R package descriptions",
    ]);
  });

  test("missing R interpreter fails before package log messages", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const config = makeConfig({
      python: undefined,
      type: ContentType.RMD,
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const onProgress = vi.fn();
    const opts = makeOptions({ config, rPath: undefined, onProgress });

    await expect(connectPublish(opts)).rejects.toThrow(
      "R interpreter is required",
    );

    const manifestLogs = onProgress.mock.calls
      .map((args: unknown[]) => args[0] as PublishEvent)
      .filter((e) => e.step === "createManifest" && e.status === "log");

    const messages = manifestLogs.map((e) => e.message);
    // The "no lockfile" message fires before the rPath check
    expect(messages).toContain(
      "No renv.lock found; automatically scanning for dependencies",
    );
    // But the scan and resolution messages should NOT have fired
    expect(messages).not.toContain("Detect dependencies from project");
    expect(messages).not.toContain("Loading packages from renv.lock");
    expect(messages).not.toContain("Done collecting R package descriptions");
  });

  test("scans for dependencies when no lockfile exists", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: {},
      lockfilePath: "/projects/myapp/renv.lock",
      lockfile: {
        R: {
          Version: "4.3.1",
          Repositories: [{ Name: "CRAN", URL: "https://cran.r-project.org" }],
        },
        Packages: {},
      },
    });

    const config = makeConfig({
      python: undefined,
      type: ContentType.RMD,
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const opts = makeOptions({ config, rPath: "/usr/bin/R" });

    await connectPublish(opts);

    const { scanRPackages } = await import("../interpreters/rPackages");
    expect(scanRPackages).toHaveBeenCalledWith(
      "/projects/myapp",
      "/usr/bin/R",
      "renv.lock",
      undefined, // positronR
    );
  });

  test("throws when R scan needed but no R interpreter", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const config = makeConfig({
      python: undefined,
      type: ContentType.RMD,
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    // No rPath provided
    const opts = makeOptions({ config, rPath: undefined });

    await expect(connectPublish(opts)).rejects.toThrow(
      "R interpreter is required",
    );
  });

  test("injects extra dependencies before scanning", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const {
      findExtraDependencies,
      recordExtraDependencies,
      cleanupExtraDependencies,
    } = await import("./extraDependencies");
    vi.mocked(findExtraDependencies).mockResolvedValue(["shiny", "rmarkdown"]);
    vi.mocked(recordExtraDependencies).mockResolvedValue(
      "/projects/myapp/.posit/__publisher_deps.R",
    );

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: {},
      lockfilePath: "/projects/myapp/renv.lock",
      lockfile: {
        R: {
          Version: "4.3.1",
          Repositories: [{ Name: "CRAN", URL: "https://cran.r-project.org" }],
        },
        Packages: {},
      },
    });

    const config = makeConfig({
      python: undefined,
      type: ContentType.QUARTO_SHINY,
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const opts = makeOptions({ config, rPath: "/usr/bin/R" });

    await connectPublish(opts);

    expect(findExtraDependencies).toHaveBeenCalledWith(
      ContentType.QUARTO_SHINY,
      undefined, // hasParameters
      "/projects/myapp",
    );
    expect(recordExtraDependencies).toHaveBeenCalledWith("/projects/myapp", [
      "shiny",
      "rmarkdown",
    ]);
    expect(cleanupExtraDependencies).toHaveBeenCalledWith(
      "/projects/myapp/.posit/__publisher_deps.R",
    );
  });

  test("cleans up extra deps file even if scan fails", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const { recordExtraDependencies, cleanupExtraDependencies } =
      await import("./extraDependencies");
    vi.mocked(recordExtraDependencies).mockResolvedValue(
      "/projects/myapp/.posit/__publisher_deps.R",
    );

    const { scanRPackages } = await import("../interpreters/rPackages");
    vi.mocked(scanRPackages).mockRejectedValue(new Error("R crashed"));

    const config = makeConfig({
      python: undefined,
      type: ContentType.RMD,
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const opts = makeOptions({ config, rPath: "/usr/bin/R" });

    await expect(connectPublish(opts)).rejects.toThrow("R crashed");

    expect(cleanupExtraDependencies).toHaveBeenCalledWith(
      "/projects/myapp/.posit/__publisher_deps.R",
    );
  });
});

describe("connectPublish — staged lockfile cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("staged lockfile is cleaned up after bundle creation", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(true);

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: { shiny: { description: { Package: "shiny" } } },
      // Non-root lockfile triggers staging
      lockfilePath: "/projects/myapp/renv/renv.lock",
      lockfile: {
        R: { Version: "4.3.1", Repositories: [] },
        Packages: {},
      },
    });

    const config = makeConfig({
      r: {
        version: "4.3.1",
        packageFile: "renv/renv.lock",
        packageManager: "renv",
      },
    });
    const opts = makeOptions({ config });

    await connectPublish(opts);

    // copyFile should have staged the lockfile
    expect(mockCopyFile).toHaveBeenCalledWith(
      "/projects/myapp/renv/renv.lock",
      path.join(
        "/projects/myapp",
        ".posit",
        "publish",
        "deployments",
        "renv.lock",
      ),
    );

    // unlink should have cleaned it up
    expect(mockUnlink).toHaveBeenCalledWith(
      path.join(
        "/projects/myapp",
        ".posit",
        "publish",
        "deployments",
        "renv.lock",
      ),
    );
  });

  test("staged lockfile is cleaned up even if bundle creation fails", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(true);

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: {},
      lockfilePath: "/projects/myapp/renv/renv.lock",
      lockfile: {
        R: { Version: "4.3.1", Repositories: [] },
        Packages: {},
      },
    });

    const { createBundle } = await import("../bundler/bundler");
    vi.mocked(createBundle).mockRejectedValueOnce(new Error("bundle failed"));

    const config = makeConfig({
      r: {
        version: "4.3.1",
        packageFile: "renv/renv.lock",
        packageManager: "renv",
      },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow("bundle failed");

    // unlink should still have been called (finally block)
    expect(mockUnlink).toHaveBeenCalledWith(
      path.join(
        "/projects/myapp",
        ".posit",
        "publish",
        "deployments",
        "renv.lock",
      ),
    );
  });

  test("no cleanup when lockfile is at project root", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(true);

    const { resolveRPackages } = await import("./dependencies");
    vi.mocked(resolveRPackages).mockResolvedValue({
      packages: {},
      // Root lockfile — no staging needed
      lockfilePath: "/projects/myapp/renv.lock",
      lockfile: {
        R: { Version: "4.3.1", Repositories: [] },
        Packages: {},
      },
    });

    const config = makeConfig({
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const opts = makeOptions({ config });

    await connectPublish(opts);

    expect(mockCopyFile).not.toHaveBeenCalled();
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});

describe("connectPublish — error classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("validation 5xx writes deployedContentNotRunning with user-friendly message", async () => {
    const api = makeMockApi();
    const axiosErr = new AxiosError(
      "Request failed with status code 502",
      "ERR_BAD_RESPONSE",
      undefined,
      undefined,
      {
        status: 502,
        statusText: "Bad Gateway",
        data: "bad gateway",
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );
    (api.validateDeployment as ReturnType<typeof vi.fn>).mockRejectedValue(
      axiosErr,
    );

    const config = makeConfig({ validate: true });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow();

    // Find the last writeFile call (error record write)
    const lastWrite = mockWriteFile.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("deployedContentNotRunning");
    // Should use a user-friendly message, not the raw Axios error
    expect(tomlContent).toContain("does not appear to be running");
    expect(tomlContent).not.toContain("Request failed with status code");
  });

  test("non-validation failure writes unknown error code", async () => {
    const api = makeMockApi();
    (api.deployBundle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("deploy exploded"),
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow("deploy exploded");

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("unknown");
    expect(tomlContent).not.toContain("deployedContentNotRunning");
  });

  test("validation failure with non-5xx stays unknown", async () => {
    const api = makeMockApi();
    // A non-HTTP error during validation (e.g. network timeout)
    (api.validateDeployment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network timeout"),
    );

    const config = makeConfig({ validate: true });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow("Network timeout");

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("unknown");
    expect(tomlContent).not.toContain("deployedContentNotRunning");
  });

  test("401 error classifies as authFailedErr", async () => {
    const api = makeMockApi();
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
    (api.testAuthentication as ReturnType<typeof vi.fn>).mockRejectedValue(
      axiosErr,
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow();

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("authFailedErr");
  });

  test("updateContent 404 classifies as deploymentNotFoundErr", async () => {
    const api = makeMockApi();
    const axiosErr = new AxiosError(
      "Not Found",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 404,
        statusText: "Not Found",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );
    (api.updateDeployment as ReturnType<typeof vi.fn>).mockRejectedValue(
      axiosErr,
    );

    const opts = makeOptions({
      api,
      existingContentId: "content-guid-123",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });

    await expect(connectPublish(opts)).rejects.toThrow();

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("deploymentNotFoundErr");
  });

  test("waitForTask plain Error classifies as deployFailed", async () => {
    const api = makeMockApi();
    (api.waitForTask as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Application failed to start"),
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow();

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("deployFailed");
  });

  test("certificate error classifies as errorCertificateVerification", async () => {
    const api = makeMockApi();
    const certErr = new AxiosError("certificate error");
    certErr.code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
    (api.testAuthentication as ReturnType<typeof vi.fn>).mockRejectedValue(
      certErr,
    );

    const opts = makeOptions({ api });

    await expect(connectPublish(opts)).rejects.toThrow();

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("errorCertificateVerification");
  });

  test("app mode mismatch classifies as appModeNotModifiableErr", async () => {
    const api = makeMockApi();
    vi.mocked(api.contentDetails).mockResolvedValue({
      data: { ...TEST_CONTENT, app_mode: "python-api" },
    } as never);

    const opts = makeOptions({
      api,
      existingContentId: "content-guid-123",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });

    await expect(connectPublish(opts)).rejects.toThrow("previously deployed");

    const lastWrite = mockWriteFile.mock.calls.at(-1);
    const tomlContent = lastWrite![1] as string;
    expect(tomlContent).toContain("appModeNotModifiableErr");
  });

  test("emits failure event with step and message on error", async () => {
    const api = makeMockApi();
    (api.uploadBundle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Upload failed: 502"),
    );

    const onProgress = vi.fn();
    const opts = makeOptions({ api, onProgress });

    await expect(connectPublish(opts)).rejects.toThrow("Upload failed: 502");

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const failureEvent = events.find((e) => e.status === "failure");
    expect(failureEvent).toMatchObject({
      step: "uploadBundle",
      status: "failure",
      message: "Upload failed: 502",
      errCode: "unknown",
    });
  });

  test("log events carry expected message strings", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const logMessages = events
      .filter((e) => e.status === "log")
      .map((e) => ({ step: e.step, message: e.message }));

    // Assert a representative subset of log messages across steps.
    // Note: createManifest emits log events from the orchestrator, but is
    // intentionally omitted from stepToEventPrefix in tsDeployProgress.ts
    // because it maps to the R-specific publish/getRPackageDescriptions
    // stage that the Go path skips for Python-only projects.
    expect(logMessages).toContainEqual({
      step: "createManifest",
      message: "Collecting package descriptions",
    });
    expect(logMessages).toContainEqual({
      step: "preflight",
      message: "Checking configuration against server capabilities",
    });
    expect(logMessages).toContainEqual({
      step: "preflight",
      message: "Testing authentication",
    });
    expect(logMessages).toContainEqual({
      step: "createBundle",
      message: "Preparing files",
    });
    expect(logMessages).toContainEqual({
      step: "createBundle",
      message: "Done preparing files",
    });
    expect(logMessages).toContainEqual({
      step: "uploadBundle",
      message: "Uploading files",
    });
    expect(logMessages).toContainEqual({
      step: "deployBundle",
      message: "Activating Deployment",
    });
    expect(logMessages).toContainEqual({
      step: "deployBundle",
      message: "Activation requested",
    });
  });

  test("createManifest emits 'not in use' for missing runtimes", async () => {
    const onProgress = vi.fn();
    // Default config has Python 3.11.0 but no R or Quarto
    const opts = makeOptions({ onProgress });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const manifestLogs = events.filter(
      (e) => e.step === "createManifest" && e.status === "log",
    );
    const messages = manifestLogs.map((e) => e.message);

    expect(messages).toContain("Local Quarto not in use");
    expect(messages).toContain("Local R not in use");
    expect(messages).toContain("Local Python version 3.11.0");
  });

  test("createManifest emits version messages in order when all runtimes set", async () => {
    const onProgress = vi.fn();
    const config = makeConfig({
      quarto: { version: "1.4.0", engines: ["jupyter"] },
      r: { version: "4.3.2", packageFile: "renv.lock", packageManager: "renv" },
      python: {
        version: "3.12.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    });
    const opts = makeOptions({ onProgress, config });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const manifestLogs = events.filter(
      (e) => e.step === "createManifest" && e.status === "log",
    );
    const versionMessages = manifestLogs
      .map((e) => e.message)
      .filter((m) => m?.startsWith("Local "));

    // Asserts content, count, AND order
    expect(versionMessages).toEqual([
      "Local Quarto version 1.4.0",
      "Local R version 4.3.2",
      "Local Python version 3.12.0",
    ]);
  });

  test("success events carry no message (detail is on preceding log events)", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const successEvents = events.filter((e) => e.status === "success");
    for (const evt of successEvents) {
      expect(evt.message).toBeUndefined();
    }
  });

  test("first deploy uses createNewDeployment step with saveName data", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress, saveName: "my-deploy" });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const newDeployStart = events.find(
      (e) => e.step === "createNewDeployment" && e.status === "start",
    );
    expect(newDeployStart).toBeDefined();
    expect(newDeployStart!.data).toEqual({ saveName: "my-deploy" });

    const newDeploySuccess = events.find(
      (e) => e.step === "createNewDeployment" && e.status === "success",
    );
    expect(newDeploySuccess).toBeDefined();
    expect(newDeploySuccess!.data).toMatchObject({ saveName: "my-deploy" });
    expect(newDeploySuccess!.data!.contentId).toBeDefined();
  });

  test("redeploy uses createDeployment step (not createNewDeployment)", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({
      onProgress,
      existingContentId: "content-guid-123",
      existingCreatedAt: "2024-06-01T00:00:00Z",
    });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    // Redeploys should NOT have createNewDeployment
    expect(
      events.find((e) => e.step === "createNewDeployment"),
    ).toBeUndefined();
    // But should have updateContent (which maps to publish/createDeployment)
    expect(events.find((e) => e.step === "updateContent")).toBeDefined();
  });

  test("updateContent start carries contentId and saveName", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress, saveName: "staging" });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const updateStart = events.find(
      (e) => e.step === "updateContent" && e.status === "start",
    );
    expect(updateStart).toBeDefined();
    expect(updateStart!.data).toMatchObject({ saveName: "staging" });
    expect(updateStart!.data!.contentId).toBeDefined();
  });

  test("createBundle success carries filename", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const bundleSuccess = events.find(
      (e) => e.step === "createBundle" && e.status === "success",
    );
    expect(bundleSuccess).toBeDefined();
    expect(bundleSuccess!.data).toEqual({ filename: "bundle.tar.gz" });
  });

  test("deployBundle success carries taskId", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ onProgress });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const deploySuccess = events.find(
      (e) => e.step === "deployBundle" && e.status === "success",
    );
    expect(deploySuccess).toBeDefined();
    expect(deploySuccess!.data).toEqual({ taskId: "task-99" });
  });

  test("validateDeployment start carries url", async () => {
    const onProgress = vi.fn();
    const config = makeConfig({ validate: true });
    const opts = makeOptions({ onProgress, config });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const validateStart = events.find(
      (e) => e.step === "validateDeployment" && e.status === "start",
    );
    expect(validateStart).toBeDefined();
    expect(validateStart!.data!.url).toMatch(/\/content\/.*\//);
  });

  test("per-variable env logging distinguishes secrets from plain vars", async () => {
    const onProgress = vi.fn();
    const config = makeConfig({
      environment: { BASE_URL: "https://api.example.com" },
    });
    const opts = makeOptions({
      onProgress,
      config,
      secrets: { API_KEY: "secret123" },
    });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const envLogs = events.filter(
      (e) => e.step === "setEnvVars" && e.status === "log",
    );
    // Filter to just the per-variable logs (exclude summary and "Done")
    const perVarLogs = envLogs.filter(
      (e) =>
        e.message !== "Setting environment variables" &&
        e.message !== "Done setting environment variables",
    );
    expect(perVarLogs).toHaveLength(2);

    const baseUrlLog = perVarLogs.find((e) => e.data?.name === "BASE_URL");
    expect(baseUrlLog).toBeDefined();
    expect(baseUrlLog!.message).toBe("Setting environment variable");

    const apiKeyLog = perVarLogs.find((e) => e.data?.name === "API_KEY");
    expect(apiKeyLog).toBeDefined();
    expect(apiKeyLog!.message).toBe("Setting secret as environment variable");
  });

  test("emits validateDeployment log events when validate is enabled", async () => {
    const onProgress = vi.fn();
    const config = makeConfig({ validate: true });
    const opts = makeOptions({ onProgress, config });

    await connectPublish(opts);

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const validateLogs = events.filter(
      (e) => e.step === "validateDeployment" && e.status === "log",
    );
    expect(validateLogs).toHaveLength(3);
    expect(validateLogs[0]!.message).toBe("Validating Deployment");
    // Message is just "Testing URL"; displayEventStreamMessage appends data.url
    expect(validateLogs[1]!.message).toBe("Testing URL");
    expect(validateLogs[1]!.data).toEqual({
      url: "/content/content-guid-123/",
    });
    expect(validateLogs[2]!.message).toBe("Done validating deployment");
  });
});

describe("connectPublish — preflight validation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore default — fileExistsAt returns true (file exists)
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(true);
  });

  test("rejects description longer than 4096 characters", async () => {
    const config = makeConfig({ description: "x".repeat(4097) });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "description cannot be longer than 4096",
    );
  });

  test("accepts description of exactly 4096 characters", async () => {
    const config = makeConfig({ description: "x".repeat(4096) });
    const opts = makeOptions({ config });

    // Should not throw for description
    await expect(connectPublish(opts)).resolves.toBeDefined();
  });

  test("missing requirements file classifies as requirementsFileReadingError", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const onProgress = vi.fn();
    const config = makeConfig({
      python: {
        version: "3.11.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    });
    const opts = makeOptions({ config, onProgress });

    await expect(connectPublish(opts)).rejects.toThrow();

    const events = onProgress.mock.calls.map(
      (args: unknown[]) => args[0] as PublishEvent,
    );
    const failure = events.find((e) => e.status === "failure");
    expect(failure).toBeDefined();
    expect(failure!.errCode).toBe("requirementsFileReadingError");
  });

  test("rejects missing requirements file", async () => {
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(false);

    const config = makeConfig({
      python: {
        version: "3.11.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Missing dependency file requirements.txt",
    );
  });

  test("rejects requirements file excluded from file patterns", async () => {
    const config = makeConfig({
      files: ["app.py", "static/"],
      python: {
        version: "3.11.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Missing dependency file requirements.txt",
    );
  });

  test("rejects requirements file when files list is empty", async () => {
    // Matches Go behavior: empty cfg.Files means the suffix-match loop
    // produces no match, so requirementsIsIncluded stays false.
    const config = makeConfig({
      files: [],
      python: {
        version: "3.11.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Missing dependency file requirements.txt",
    );
  });

  test("accepts requirements file when included in patterns", async () => {
    const config = makeConfig({
      files: ["app.py", "requirements.txt"],
      python: {
        version: "3.11.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).resolves.toBeDefined();
  });

  test("skips requirements check when no python config", async () => {
    const config = makeConfig({ python: undefined, type: ContentType.HTML });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).resolves.toBeDefined();
  });
});

describe("connectPublish — server settings validation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { fileExistsAt } = await import("../interpreters/fsUtils");
    vi.mocked(fileExistsAt).mockResolvedValue(true);
  });

  // --- API licensing ---

  test("rejects API content when allow-apis is not licensed", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        general: {
          license: {
            "allow-apis": false,
            "current-user-execution": true,
            "enable-launcher": true,
            "oauth-integrations": true,
          },
        } as AllSettings["general"],
      }),
    );

    const config = makeConfig({ type: ContentType.PYTHON_FASTAPI });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "API deployment is not licensed",
    );
  });

  test("accepts API content when allow-apis is licensed", async () => {
    const config = makeConfig({ type: ContentType.PYTHON_FASTAPI });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).resolves.toBeDefined();
  });

  test("rejects R Plumber API when allow-apis is not licensed", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        general: {
          license: {
            "allow-apis": false,
            "current-user-execution": true,
            "enable-launcher": true,
            "oauth-integrations": true,
          },
        } as AllSettings["general"],
      }),
    );

    const config = makeConfig({
      type: ContentType.R_PLUMBER,
      python: undefined,
      r: { version: "4.3.1", packageFile: "renv.lock", packageManager: "renv" },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "API deployment is not licensed",
    );
  });

  // --- RACU (run_as_current_user) ---

  test("rejects RACU when not licensed", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        general: {
          license: {
            "allow-apis": true,
            "current-user-execution": false,
            "enable-launcher": true,
            "oauth-integrations": true,
          },
        } as AllSettings["general"],
      }),
    );

    const config = makeConfig({
      connect: { access: { runAsCurrentUser: true } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "run_as_current_user is not licensed",
    );
  });

  test("rejects RACU when not configured on server", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        application: {
          access_types: [],
          run_as: "",
          run_as_group: "",
          run_as_current_user: false,
        },
      }),
    );

    const config = makeConfig({
      connect: { access: { runAsCurrentUser: true } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "run_as_current_user is not configured",
    );
  });

  test("rejects RACU when user is not admin", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        user: { user_role: "publisher" } as AllSettings["user"],
      }),
    );

    const config = makeConfig({
      connect: { access: { runAsCurrentUser: true } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "run_as_current_user requires administrator privileges",
    );
  });

  test("rejects RACU for non-app content types", async () => {
    const config = makeConfig({
      type: ContentType.PYTHON_FASTAPI,
      connect: { access: { runAsCurrentUser: true } },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "run_as_current_user can only be used with application types",
    );
  });

  test("accepts RACU for app content with admin + licensed + configured", async () => {
    const config = makeConfig({
      type: ContentType.PYTHON_SHINY,
      connect: { access: { runAsCurrentUser: true } },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).resolves.toBeDefined();
  });

  test("rejects run_as when user is not admin", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        user: { user_role: "publisher" } as AllSettings["user"],
      }),
    );

    const config = makeConfig({
      connect: { access: { runAs: "rstudio" } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "run_as requires administrator privileges",
    );
  });

  // --- Runtime settings ---

  test("rejects runtime settings for static content", async () => {
    const config = makeConfig({
      type: ContentType.HTML,
      python: undefined,
      connect: { runtime: { maxProcesses: 5 } },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Runtime settings cannot be applied to static content",
    );
  });

  test("rejects max_processes exceeding server limit", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        scheduler: { max_processes_limit: 5 } as AllSettings["scheduler"],
      }),
    );

    const config = makeConfig({
      connect: { runtime: { maxProcesses: 10 } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "max_processes value of 10 is higher than configured maximum of 5",
    );
  });

  test("rejects min_processes exceeding max_processes", async () => {
    const config = makeConfig({
      connect: { runtime: { minProcesses: 5, maxProcesses: 2 } },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "min_processes value of 5 is higher than max_processes value of 2",
    );
  });

  test("accepts runtime settings within limits", async () => {
    const config = makeConfig({
      connect: { runtime: { minProcesses: 1, maxProcesses: 5 } },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).resolves.toBeDefined();
  });

  // --- Kubernetes ---

  test("rejects kubernetes config when not licensed", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        general: {
          license: {
            "allow-apis": true,
            "current-user-execution": true,
            "enable-launcher": false,
            "oauth-integrations": true,
          },
        } as AllSettings["general"],
      }),
    );

    const config = makeConfig({
      connect: { kubernetes: { cpuRequest: 1 } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Kubernetes is not licensed",
    );
  });

  test("rejects kubernetes config when execution type is not Kubernetes", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        general: { execution_type: "Local" } as AllSettings["general"],
      }),
    );

    const config = makeConfig({
      connect: { kubernetes: { cpuRequest: 1 } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Kubernetes is not configured",
    );
  });

  test("rejects default_image_name when image selection not enabled", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        general: {
          default_image_selection_enabled: false,
        } as AllSettings["general"],
      }),
    );

    const config = makeConfig({
      connect: { kubernetes: { defaultImageName: "my-image:latest" } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "Default image selection is not enabled",
    );
  });

  test("rejects service_account_name when user is not admin", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        user: { user_role: "publisher" } as AllSettings["user"],
      }),
    );

    const config = makeConfig({
      connect: { kubernetes: { serviceAccountName: "my-svc" } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "service_account_name requires administrator privileges",
    );
  });

  test("rejects cpu_request exceeding server maximum", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        scheduler: { max_cpu_request: 4 } as AllSettings["scheduler"],
      }),
    );

    const config = makeConfig({
      connect: { kubernetes: { cpuRequest: 10 } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "cpu_request value of 10 is higher than configured maximum of 4",
    );
  });

  test("rejects memory_request exceeding memory_limit", async () => {
    const config = makeConfig({
      connect: { kubernetes: { memoryRequest: 4096, memoryLimit: 2048 } },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "memory_request value of 4096 is higher than memory_limit value of 2048",
    );
  });

  test("rejects negative resource values", async () => {
    const config = makeConfig({
      connect: { kubernetes: { cpuRequest: -1 } },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "cpu_request value cannot be less than 0",
    );
  });

  test("rejects negative resource values even when server max is 0 (unlimited)", async () => {
    const api = makeMockApi();
    vi.mocked(api.getSettings).mockResolvedValue(
      makeSettings({
        scheduler: { max_cpu_request: 0 } as AllSettings["scheduler"],
      }),
    );

    const config = makeConfig({
      connect: { kubernetes: { cpuRequest: -1 } },
    });
    const opts = makeOptions({ api, config });

    await expect(connectPublish(opts)).rejects.toThrow(
      "cpu_request value cannot be less than 0",
    );
  });

  test("accepts kubernetes config within all limits", async () => {
    const config = makeConfig({
      connect: {
        kubernetes: {
          cpuRequest: 1,
          cpuLimit: 4,
          memoryRequest: 512,
          memoryLimit: 2048,
        },
      },
    });
    const opts = makeOptions({ config });

    await expect(connectPublish(opts)).resolves.toBeDefined();
  });

  test("skips settings checks when no connect config", async () => {
    const config = makeConfig({ connect: undefined });
    const opts = makeOptions({ config });

    // Should pass — no connect config means no RACU/runtime/k8s checks
    await expect(connectPublish(opts)).resolves.toBeDefined();
  });
});

describe("connectPublish — cancellation", () => {
  test("throws CancelledError when signal is already aborted", async () => {
    const opts = makeOptions({ signal: AbortSignal.abort() });
    await expect(connectPublish(opts)).rejects.toThrow(CancelledError);
  });

  test("throws CancelledError when aborted between steps", async () => {
    const controller = new AbortController();
    const api = makeMockApi();

    // Abort after testAuthentication returns (between preflight and next step)
    vi.mocked(api.testAuthentication).mockImplementation(() => {
      controller.abort();
      return Promise.resolve({ user: TEST_USER, error: null });
    });

    const opts = makeOptions({ api, signal: controller.signal });
    await expect(connectPublish(opts)).rejects.toThrow(CancelledError);

    // Should not have proceeded to createDeployment/updateDeployment
    expect(api.createDeployment).not.toHaveBeenCalled();
    expect(api.updateDeployment).not.toHaveBeenCalled();
  });

  test("writes dismissedAt to deployment record on cancellation", async () => {
    const opts = makeOptions({ signal: AbortSignal.abort() });

    try {
      await connectPublish(opts);
    } catch {
      // expected
    }

    // The last writeFile call should contain dismissed_at
    const lastWriteCall = mockWriteFile.mock.calls.at(-1);
    expect(lastWriteCall).toBeDefined();
    const content = lastWriteCall![1] as string;
    expect(content).toContain("dismissed_at");
  });

  test("does not write deploymentError on cancellation", async () => {
    const opts = makeOptions({ signal: AbortSignal.abort() });

    try {
      await connectPublish(opts);
    } catch {
      // expected
    }

    const lastWriteCall = mockWriteFile.mock.calls.at(-1);
    const content = lastWriteCall![1] as string;
    expect(content).not.toContain("deployment_error");
  });

  test("emits no failure event on cancellation (handled by caller)", async () => {
    const onProgress = vi.fn();
    const opts = makeOptions({ signal: AbortSignal.abort(), onProgress });

    try {
      await connectPublish(opts);
    } catch {
      // expected
    }

    const failureEvents = onProgress.mock.calls
      .map((args: unknown[]) => args[0] as PublishEvent)
      .filter((e) => e.status === "failure");
    expect(failureEvents).toHaveLength(0);
  });

  test("normalizes in-flight abort errors to CancelledError", async () => {
    const controller = new AbortController();
    const api = makeMockApi();

    // Simulate abort during uploadBundle (in-flight HTTP request)
    vi.mocked(api.uploadBundle).mockImplementation(async () => {
      controller.abort();
      throw new Error("canceled");
    });

    const opts = makeOptions({ api, signal: controller.signal });
    await expect(connectPublish(opts)).rejects.toThrow(CancelledError);

    // Should write dismissedAt, not deploymentError
    const lastWriteCall = mockWriteFile.mock.calls.at(-1);
    const content = lastWriteCall![1] as string;
    expect(content).toContain("dismissed_at");
    expect(content).not.toContain("deployment_error");
  });
});
