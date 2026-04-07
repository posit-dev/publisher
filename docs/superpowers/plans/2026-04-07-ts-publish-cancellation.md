# TS Publish Path: Cancellation Support

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cancellation support to the TypeScript publish path so users can dismiss in-progress deployments, matching the Go path's existing UX.

**Architecture:** Thread an `AbortSignal` from the VSCode progress notification's cancellation token through `runTsDeployWithProgress()` into `connectPublish()` and its `ConnectAPI` calls. On cancellation: abort the current/next API call, write `dismissedAt` to the deployment record, inject a `publish/failure` event with `canceled: "true"`, and send `PUBLISH_CANCEL` to the webview. The Connect server cannot cancel running tasks, so server-side work continues (same as Go path).

**Tech Stack:** TypeScript, VSCode Extension API (`CancellationToken`), `AbortController`/`AbortSignal`, axios signal support, Vitest

**Closes:** #3833

---

## File Map

| File                                                   | Action    | Responsibility                                                                                      |
| ------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------- |
| `packages/connect-api/src/client.ts`                   | Modify    | Add optional `signal` parameter to all API methods                                                  |
| `packages/connect-api/src/client.test.ts`              | Create    | Test signal propagation and abort behavior                                                          |
| `extensions/vscode/src/publish/connectPublish.ts`      | Modify    | Accept `AbortSignal`, check between steps, add `dismissedAt` to `PublishRecord`, pass signal to API |
| `extensions/vscode/src/publish/connectPublish.test.ts` | Modify    | Add cancellation tests                                                                              |
| `extensions/vscode/src/views/tsDeployProgress.ts`      | Modify    | Wire `cancellable: true`, create `AbortController`, handle cancellation event injection             |
| `extensions/vscode/src/views/tsDeployProgress.test.ts` | Modify    | Add cancellation tests                                                                              |
| `extensions/vscode/src/views/homeView.ts`              | No change | Already calls `runTsDeployWithProgress()` — cancellation is handled inside                          |

## Design Decisions

1. **Custom error class for cancellation** — `connectPublish` throws a distinguishable `CancelledError` so `tsDeployProgress` can tell cancellation apart from real failures without inspecting `AbortError` internals or axios's `CanceledError`.

2. **Signal check between steps** — Each step in `connectPublish` checks `signal.aborted` before starting. This means cancellation takes effect at the next step boundary, not mid-HTTP-request. We also pass the signal to axios so in-flight requests (especially the long `waitForTask` polling) are interrupted promptly.

3. **`dismissedAt` on the deployment record** — Matches the Go path's `CancelDeployment()` which writes `DismissedAt` and clears `Error`. We add `dismissedAt` to `PublishRecord` and `recordToTomlObject`.

4. **No `stream.suppressMessages`** — The Go path uses `suppressMessages(localID)` because the Go goroutine keeps emitting SSE events after cancellation. The TS path doesn't have that problem — once `connectPublish` throws, no more events are emitted.

5. **`WebviewConduit` in `tsDeployProgress`** — The Go path creates a `WebviewConduit` in `deployProgress.ts` to send `PUBLISH_CANCEL`. We need to accept an optional `onCancel` callback instead, because the conduit is owned by `HomeViewProvider`. The conduit message will be sent from the caller side.

---

### Task 1: Add `signal` parameter to ConnectAPI methods

**Files:**

- Modify: `packages/connect-api/src/client.ts`
- Create: `packages/connect-api/src/client.test.ts`

- [ ] **Step 1: Write the failing test for signal propagation**

Create `packages/connect-api/src/client.test.ts`:

```typescript
// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectAPI } from "./client.js";

// We test that abort signals are forwarded by aborting before the request
// and verifying that the method rejects. We use a real ConnectAPI pointed
// at a non-routable address so the signal races the connection timeout.

function makeApi(): ConnectAPI {
  return new ConnectAPI({
    url: "http://192.0.2.1", // RFC 5737 TEST-NET — guaranteed non-routable
    apiKey: "test-key",
    timeout: 30_000, // long timeout so the signal wins the race
  });
}

function abortedSignal(): AbortSignal {
  return AbortSignal.abort();
}

describe("ConnectAPI signal support", () => {
  it("testAuthentication rejects with an already-aborted signal", async () => {
    const api = makeApi();
    await expect(api.testAuthentication(abortedSignal())).rejects.toThrow();
  });

  it("uploadBundle rejects with an already-aborted signal", async () => {
    const api = makeApi();
    await expect(
      api.uploadBundle("content-1", new Uint8Array(), abortedSignal()),
    ).rejects.toThrow();
  });

  it("waitForTask rejects with an already-aborted signal", async () => {
    const api = makeApi();
    await expect(
      api.waitForTask("task-1", 0, undefined, abortedSignal()),
    ).rejects.toThrow();
  });

  it("validateDeployment rejects with an already-aborted signal", async () => {
    const api = makeApi();
    await expect(
      api.validateDeployment("content-1", abortedSignal()),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/connect-api && npx vitest run src/client.test.ts`
Expected: FAIL — `testAuthentication` doesn't accept a signal parameter yet.

- [ ] **Step 3: Add `signal` parameter to all ConnectAPI methods**

In `packages/connect-api/src/client.ts`, add an optional `signal?: AbortSignal` parameter to each public method and pass it through to the axios call via `{ signal }` in the request config. The changes are:

```typescript
// testAuthentication — add signal parameter
async testAuthentication(signal?: AbortSignal): Promise<{ user: User; error: null }> {
  let data: UserDTO;
  try {
    ({ data } = await this.client.get<UserDTO>("/__api__/v1/user", { signal }));
  } catch (err) {
    // ... existing error handling unchanged ...
  }
  // ... rest unchanged ...
}

// contentDetails
async contentDetails(contentId: ContentID, signal?: AbortSignal): Promise<AxiosResponse<ContentDetailsDTO>> {
  return this.client.get<ContentDetailsDTO>(`/__api__/v1/content/${contentId}`, { signal });
}

// createDeployment
async createDeployment(body: ConnectContent, signal?: AbortSignal): Promise<AxiosResponse<ContentDetailsDTO>> {
  return this.client.post<ContentDetailsDTO>("/__api__/v1/content", body, { signal });
}

// updateDeployment
async updateDeployment(contentId: ContentID, body: ConnectContent, signal?: AbortSignal): Promise<void> {
  await this.client.patch(`/__api__/v1/content/${contentId}`, body, { signal });
}

// getEnvVars
async getEnvVars(contentId: ContentID, signal?: AbortSignal): Promise<AxiosResponse<string[]>> {
  return this.client.get<string[]>(`/__api__/v1/content/${contentId}/environment`, { signal });
}

// setEnvVars
async setEnvVars(contentId: ContentID, env: Record<string, string>, signal?: AbortSignal): Promise<void> {
  await this.client.patch(
    `/__api__/v1/content/${contentId}/environment`,
    Object.entries(env).map(([name, value]) => ({ name, value })),
    { signal },
  );
}

// uploadBundle
async uploadBundle(contentId: ContentID, bundle: Uint8Array, signal?: AbortSignal): Promise<AxiosResponse<BundleDTO>> {
  return this.client.post<BundleDTO>(
    `/__api__/v1/content/${contentId}/bundles`,
    bundle,
    { headers: { "Content-Type": "application/gzip" }, signal },
  );
}

// deployBundle
async deployBundle(contentId: ContentID, bundleId: BundleID, signal?: AbortSignal): Promise<AxiosResponse<DeployOutput>> {
  return this.client.post<DeployOutput>(
    `/__api__/v1/content/${contentId}/deploy`,
    { bundle_id: bundleId },
    { signal },
  );
}

// waitForTask — add signal parameter (4th parameter after onOutput)
async waitForTask(
  taskId: TaskID,
  pollIntervalMs = 500,
  onOutput?: (lines: string[]) => void,
  signal?: AbortSignal,
): Promise<TaskDTO> {
  let firstLine = 0;

  while (true) {
    signal?.throwIfAborted();

    const { data: task } = await this.client.get<TaskDTO>(
      `/__api__/v1/tasks/${taskId}`,
      { params: { first: firstLine }, signal },
    );

    if (onOutput && task.output.length > 0) {
      onOutput(task.output);
    }

    if (task.finished) {
      if (task.error) {
        throw new Error(task.error);
      }
      return task;
    }

    firstLine = task.last;

    if (pollIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}

// validateDeployment
async validateDeployment(contentId: ContentID, signal?: AbortSignal): Promise<void> {
  await this.client.get(`/content/${contentId}/`, {
    validateStatus: (status: number) => status < 500,
    signal,
  });
}

// getSettings
async getSettings(appMode?: string, signal?: AbortSignal): Promise<AllSettings> {
  // ... same logic but pass { signal } to each get call in Promise.all ...
  const [
    { data: user },
    { data: general },
    { data: application },
    { data: scheduler },
    { data: python },
    { data: r },
    { data: quarto },
  ] = await Promise.all([
    this.client.get<UserDTO>("/__api__/v1/user", { signal }),
    this.client.get<ServerSettings>("/__api__/server_settings", { signal }),
    this.client.get<ApplicationSettings>("/__api__/server_settings/applications", { signal }),
    this.client.get<SchedulerSettings>(schedulerPath, { signal }),
    this.client.get<PyInfo>("/__api__/v1/server_settings/python", { signal }),
    this.client.get<RInfo>("/__api__/v1/server_settings/r", { signal }),
    this.client.get<QuartoInfo>("/__api__/v1/server_settings/quarto", { signal }),
  ]);
  return { general, user, application, scheduler, python, r, quarto };
}
```

Note: `getIntegrations` and `downloadBundle` are not used in the publish flow, so adding `signal` to them is optional. Do it for consistency if you like but it's not required.

- [ ] **Step 4: Also add `timeout` to `ConnectAPIOptions` type**

Check `packages/connect-api/src/types.ts` for the `ConnectAPIOptions` type. If `timeout` is not already present, add it:

```typescript
export type ConnectAPIOptions = {
  url: string;
  apiKey?: string;
  token?: string;
  privateKey?: string;
  rejectUnauthorized?: boolean;
  timeout?: number;
};
```

(The constructor already uses `options.timeout` — this just ensures the type matches.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/connect-api && npx vitest run src/client.test.ts`
Expected: PASS — all 4 tests pass (abort signals cause rejection).

- [ ] **Step 6: Run existing tests to check for regressions**

Run: `cd packages/connect-api && npx vitest run`
Expected: All existing tests pass. The new optional parameters don't break existing callers.

- [ ] **Step 7: Commit**

```bash
git add packages/connect-api/src/client.ts packages/connect-api/src/client.test.ts packages/connect-api/src/types.ts
git commit -m "feat: add AbortSignal support to ConnectAPI methods (#3833)

Thread an optional signal parameter through all public ConnectAPI
methods so callers can cancel in-flight HTTP requests. The waitForTask
polling loop also checks signal.throwIfAborted() each iteration.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add `dismissedAt` to `PublishRecord` and accept `AbortSignal` in `connectPublish`

**Files:**

- Modify: `extensions/vscode/src/publish/connectPublish.ts`
- Modify: `extensions/vscode/src/publish/connectPublish.test.ts`

- [ ] **Step 1: Write failing tests for cancellation**

Add to `extensions/vscode/src/publish/connectPublish.test.ts`:

```typescript
import {
  connectPublish,
  CancelledError,
  type ConnectPublishOptions,
  type PublishEvent,
  type PublishStep,
} from "./connectPublish";

// ... after existing tests ...

describe("connectPublish — cancellation", () => {
  test("throws CancelledError when signal is already aborted", async () => {
    const opts = makeOptions({ signal: AbortSignal.abort() });
    await expect(connectPublish(opts)).rejects.toThrow(CancelledError);
  });

  test("throws CancelledError when aborted between steps", async () => {
    const controller = new AbortController();
    const api = makeMockApi();

    // Abort after testAuthentication returns (between preflight and next step)
    vi.mocked(api.testAuthentication).mockImplementation(async () => {
      controller.abort();
      return { user: TEST_USER, error: null };
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd extensions/vscode && npx vitest run src/publish/connectPublish.test.ts`
Expected: FAIL — `CancelledError` is not exported, `signal` is not in `ConnectPublishOptions`.

- [ ] **Step 3: Add `dismissedAt` to `PublishRecord` and `recordToTomlObject`**

In `extensions/vscode/src/publish/connectPublish.ts`:

Add `dismissedAt` to `PublishRecord` type (after `deployedAt`):

```typescript
export type PublishRecord = {
  // ... existing fields ...
  deployedAt?: string;
  dismissedAt?: string;
  deploymentError?: { code: string; message: string; operation: string };
};
```

Add `dismissed_at` to `recordToTomlObject` (after `deployed_at`):

```typescript
return {
  // ... existing fields ...
  deployed_at: record.deployedAt || undefined,
  dismissed_at: record.dismissedAt || undefined,
  deployment_error: record.deploymentError || undefined,
};
```

- [ ] **Step 4: Add `CancelledError` class and `signal` to `ConnectPublishOptions`**

In `extensions/vscode/src/publish/connectPublish.ts`:

Add the error class near the top of the file (after imports, before type definitions):

```typescript
/**
 * Thrown when a deployment is cancelled via AbortSignal.
 * Distinguishable from real errors so callers can handle cancellation differently.
 */
export class CancelledError extends Error {
  constructor() {
    super("Deployment cancelled");
    this.name = "CancelledError";
  }
}
```

Add `signal` to `ConnectPublishOptions`:

```typescript
export type ConnectPublishOptions = {
  // ... existing fields ...
  /** Progress callback invoked at each step boundary. */
  onProgress: (event: PublishEvent) => void;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
};
```

- [ ] **Step 5: Add cancellation logic to `connectPublish`**

In the `connectPublish` function body, add a helper and signal checks:

After destructuring `options`, add:

```typescript
const signal = options.signal;

/** Check if cancelled; if so, write dismissedAt and throw CancelledError. */
async function throwIfCancelled(): Promise<void> {
  if (signal?.aborted) {
    record.dismissedAt = new Date().toISOString();
    record.deploymentError = undefined;
    try {
      await writePublishRecord(deploymentPath, record);
    } catch {
      // Don't mask cancellation
    }
    throw new CancelledError();
  }
}
```

Add `await throwIfCancelled()` at the start of the `try` block (before step 1) and between each step. There are natural boundaries — add the check before each `lastStep = "..."` assignment:

```typescript
try {
    await throwIfCancelled();

    // Step 1: Build manifest
    lastStep = "createManifest";
    // ...

    await throwIfCancelled();

    // Step 2: Preflight
    lastStep = "preflight";
    // ...

    await throwIfCancelled();

    // Step 3: Create or update content
    // ...

    await throwIfCancelled();

    // Step 4: Create bundle
    lastStep = "createBundle";
    // ...

    await throwIfCancelled();

    // Step 5: Upload bundle
    lastStep = "uploadBundle";
    // ...

    // ... and so on for each step boundary ...
```

Also pass `signal` to each API call. For example:

```typescript
// In preflight:
const { user } = await api.testAuthentication(signal);

// In create/update content:
const { data: contentDetails } = await api.createDeployment(
  connectContent,
  signal,
);
await api.updateDeployment(contentId, connectContent, signal);

// In upload bundle:
const { data: bundleDTO } = await api.uploadBundle(contentId, bundle, signal);

// In set env vars:
await api.setEnvVars(contentId, mergedEnv, signal);

// In deploy bundle:
const { data: deployOutput } = await api.deployBundle(
  contentId,
  bundleDTO.id,
  signal,
);

// In waitForTask:
await api.waitForTask(taskId, 500, onLogLines, signal);

// In validate:
await api.validateDeployment(contentId, signal);
```

In the `catch` block, add a guard at the top to re-throw `CancelledError` without recording it as an error:

```typescript
  } catch (err) {
    // Cancellation is not an error — dismissedAt was already written
    if (err instanceof CancelledError) {
      throw err;
    }

    // ... existing error classification and recording ...
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd extensions/vscode && npx vitest run src/publish/connectPublish.test.ts`
Expected: PASS — all existing tests and new cancellation tests pass.

- [ ] **Step 7: Commit**

```bash
git add extensions/vscode/src/publish/connectPublish.ts extensions/vscode/src/publish/connectPublish.test.ts
git commit -m "feat: add AbortSignal cancellation to connectPublish (#3833)

connectPublish now accepts an optional signal. When aborted, it writes
dismissedAt to the deployment record (clearing any error) and throws
CancelledError. The signal is also forwarded to all ConnectAPI calls
for prompt interruption of in-flight requests.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Wire cancellation into `runTsDeployWithProgress`

**Files:**

- Modify: `extensions/vscode/src/views/tsDeployProgress.ts`
- Modify: `extensions/vscode/src/views/tsDeployProgress.test.ts`

- [ ] **Step 1: Write failing tests for cancellation in progress wrapper**

Add to `extensions/vscode/src/views/tsDeployProgress.test.ts`. First, update the vscode mock to support cancellation:

```typescript
// Replace the existing vscode mock with one that supports cancellation:
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

// Add to beforeEach:
beforeEach(() => {
  vi.clearAllMocks();
  capturedCancellationHandler = undefined;
  mockCancellable = undefined;
});
```

Then add the cancellation tests:

```typescript
describe("cancellation", () => {
  it("sets cancellable: true on the progress notification", async () => {
    run(() => Promise.resolve(successResult));

    await vi.waitFor(() => {
      expect(mockCancellable).toBe(true);
    });
  });

  it("injects publish/failure with canceled flag when cancelled", async () => {
    let deployResolve: (r: PublishResult) => void;
    const deployPromise = new Promise<PublishResult>((resolve) => {
      deployResolve = resolve;
    });

    const { stream } = run(() => deployPromise);

    // Simulate user clicking cancel
    capturedCancellationHandler?.();

    // Now resolve the deploy (it would have been aborted in real life,
    // but for this test we just need to verify the cancellation handler ran)
    deployResolve!(successResult);

    await vi.waitFor(() => {
      const failMsg = stream.injected.find((m) => m.type === "publish/failure");
      expect(failMsg).toBeDefined();
      expect(failMsg!.data.canceled).toBe("true");
      expect(failMsg!.data.message).toContain("dismissed");
    });
  });

  it("calls onCancel callback when cancelled", async () => {
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

  it("does not show error notification on CancelledError", async () => {
    const { CancelledError } = await import("src/publish/connectPublish");

    run(() => Promise.reject(new CancelledError()));

    await vi.waitFor(() => {
      expect(mockShowErrorMessage).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd extensions/vscode && npx vitest run src/views/tsDeployProgress.test.ts`
Expected: FAIL — `cancellable` is `false`, no cancellation handler, `onCancel` not in options type.

- [ ] **Step 3: Update `TsDeployProgressOptions` type**

In `extensions/vscode/src/views/tsDeployProgress.ts`, update the options type:

```typescript
export type TsDeployProgressOptions = {
  deploy: (
    onProgress: (event: PublishEvent) => void,
    signal: AbortSignal,
  ) => Promise<PublishResult>;
  /** Called after deployment completes (success or failure) for cleanup like refreshing content records. */
  onComplete: () => void;
  /** Called when the user cancels the deployment (e.g. to send PUBLISH_CANCEL to webview). */
  onCancel?: () => void;
  stream: EventStream;
  serverUrl: string;
  title: string;
};
```

Note: The `deploy` function signature now includes `signal: AbortSignal` as its second parameter.

- [ ] **Step 4: Implement cancellation in `runTsDeployWithProgress`**

In `extensions/vscode/src/views/tsDeployProgress.ts`, add the import:

```typescript
import { CancelledError } from "src/publish/connectPublish";
```

Update `runTsDeployWithProgress`:

```typescript
export function runTsDeployWithProgress(
  options: TsDeployProgressOptions,
): void {
  const { deploy, onComplete, onCancel, stream, serverUrl, title } = options;

  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Deploying your project",
      cancellable: true,
    },
    async (progress, token) => {
      const controller = new AbortController();

      token.onCancellationRequested(() => {
        controller.abort();

        // Inject publish/failure with canceled flag — mirrors Go path behavior.
        // This tells the logs tree and HomeView that the deployment was dismissed.
        stream.injectMessage(
          makeMessage("publish/failure", {
            canceled: "true",
            message:
              "Deployment has been dismissed, but may continue to be processed on the Connect Server.",
            productType: "connect",
          }),
        );

        onCancel?.();
      });

      // ... rest of existing function body ...
      // (inject publish/start, set up tracking vars, call deploy, etc.)
```

The existing `try/catch/finally` needs one change — in the `catch` block, suppress the `publish/failure` injection and error display for `CancelledError` (since the cancellation handler already injected it):

```typescript
      } catch (err) {
        // CancelledError is not a real failure — the cancellation handler
        // already injected publish/failure with canceled: "true".
        if (err instanceof CancelledError) {
          return;
        }

        // ... existing error handling (publish/failure injection for real errors) ...
      } finally {
        onComplete();
      }
```

- [ ] **Step 5: Update the `deploy` call to pass the signal**

In the `try` block where `deploy` is called, pass the abort signal:

```typescript
const result = await deploy((event) => {
  // ... existing event handler unchanged ...
}, controller.signal);
```

- [ ] **Step 6: Update homeView.ts to pass signal through**

In `extensions/vscode/src/views/homeView.ts`, update the `runTsDeployWithProgress` call in `initiateTsDeployment`:

```typescript
runTsDeployWithProgress({
  deploy: (onProgress, signal) =>
    connectPublish({
      api: connectApi,
      projectDir: absProjectDir,
      saveName: deploymentName,
      config: config.configuration,
      configName: config.configurationName,
      serverUrl: credential.url,
      serverType: credential.serverType,
      existingContentId,
      existingCreatedAt,
      secrets,
      rPath: r?.rPath,
      positronR: positron.r,
      clientVersion,
      onProgress,
      signal,
    }),
  onComplete: () => this.refreshContentRecords(),
  onCancel: () => {
    this.webviewConduit.sendMsg({
      kind: HostToWebviewMessageType.PUBLISH_CANCEL,
    });
  },
  stream: this.stream,
  serverUrl: credential.url,
  title: deploymentName,
});
```

- [ ] **Step 7: Run tsDeployProgress tests**

Run: `cd extensions/vscode && npx vitest run src/views/tsDeployProgress.test.ts`
Expected: PASS — all existing tests and new cancellation tests pass.

- [ ] **Step 8: Run connectPublish tests to check for regressions**

Run: `cd extensions/vscode && npx vitest run src/publish/connectPublish.test.ts`
Expected: PASS — the `deploy` signature change shouldn't affect these tests since they call `connectPublish` directly, not through `runTsDeployWithProgress`.

- [ ] **Step 9: Run all extension unit tests**

Run: `cd extensions/vscode && npm run test-unit`
Expected: PASS — no regressions.

- [ ] **Step 10: Commit**

```bash
git add extensions/vscode/src/views/tsDeployProgress.ts extensions/vscode/src/views/tsDeployProgress.test.ts extensions/vscode/src/views/homeView.ts
git commit -m "feat: wire cancellation into TS deploy progress notification (#3833)

The TS deploy progress notification is now cancellable. Clicking cancel
aborts the AbortController, injects publish/failure with canceled flag,
and sends PUBLISH_CANCEL to the webview. CancelledError from the
orchestrator is handled silently (no error notification).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full extension test suite**

Run: `cd extensions/vscode && just test`
Expected: PASS — both Mocha and Vitest tests pass.

- [ ] **Step 2: Run package tests**

Run: `cd packages/connect-api && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Run pre-commit checks**

Run: `cd extensions/vscode && just lint`
Expected: PASS — no lint errors.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd extensions/vscode && npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 5: Manual smoke test (optional)**

If you can run the extension in development mode (F5 in VSCode):

1. Configure a deployment to a Connect server
2. Start a deploy via the TS path
3. Click the cancel button on the progress notification
4. Verify: progress notification closes, logs tree shows "Deployment dismissed", deployment record has `dismissed_at` field

---

## What This Does NOT Cover

- **Cancellation for the Go publish path** — that already works via `deployProgress.ts` calling the Go API
- **Server-side task cancellation** — Connect's API doesn't support it (same limitation as Go path)
- **Connect Cloud / Snowflake paths** — these route through the Go backend, not the TS orchestrator
