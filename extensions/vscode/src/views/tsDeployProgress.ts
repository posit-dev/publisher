// Copyright (C) 2026 by Posit Software, PBC.

import { ProgressLocation, Uri, env, window } from "vscode";
import type {
  PublishEvent,
  PublishResult,
  PublishStep,
} from "src/publish/connectPublish";
import { CanceledError } from "src/publish/connectPublish";
import type { EventStream } from "src/events";
import type { EventStreamMessage, EventSubscriptionTarget } from "src/api";
import type { ErrorCode } from "src/utils/errorTypes";

// Patterns that signal the server has finished restoring the environment
// and is now launching the content. Mirrors Go's eventOpFromLogLine().
const launchPattern =
  /Launching .*(Quarto|R Markdown|application|API|notebook)/;
const staticPattern = /(Building|Launching) static content/;

// Package installation patterns for progress counting.
// Mirrors Go's packageEventFromLogLine() in client_connect.go.
const rPackagePattern = /Installing ([\w.]+) \((\S+)\) \.\.\./;
const pythonCollectingPattern = /Collecting (\S+)==(\S+)/;
// The empty capture group () for version is intentional, matching Go's regex.
// "Found existing installation" reports the OLD version being replaced;
// the meaningful new version comes from the Collecting line. With an empty
// version, the tree label shows "numpy..." instead of a misleading old version.
const pythonInstallingPattern = /Found existing installation: (\S+) ()\S+/;

const stepLabels: Record<PublishStep, string> = {
  createManifest: "Preparing manifest…",
  preflight: "Verifying credentials…",
  createNewDeployment: "Creating deployment…",
  createDeployment: "Creating deployment…",
  createBundle: "Building bundle…",
  uploadBundle: "Uploading bundle…",
  updateContent: "Updating content settings…",
  setEnvVars: "Setting environment variables…",
  deployBundle: "Deploying bundle…",
  waitForTask: "Waiting for server…",
  validateDeployment: "Validating deployment…",
};

// Maps TS orchestrator steps to Go SSE event path prefixes.
const stepToEventPrefix = {
  // Go maps this to publish/getRPackageDescriptions, which creates a tree
  // node even for Python-only deploys. We match that behavior for parity.
  // TODO: Consider suppressing the tree node for non-R deploys, or renaming
  // the stage to something language-neutral like "publish/collectPackages".
  createManifest: "publish/getRPackageDescriptions",
  preflight: "publish/checkCapabilities",
  // First deploy uses createNewDeployment — the logs tree doesn't register
  // this stage, but displayEventStreamMessage handles the success event to
  // show "Created new Deployment as {saveName}" in the raw log view.
  createNewDeployment: "publish/createNewDeployment",
  createDeployment: "publish/createDeployment",
  createBundle: "publish/createBundle",
  uploadBundle: "publish/uploadBundle",
  // updateContent maps to the same tree stage as createDeployment —
  // in the Go path, publish/createDeployment covers both first-deploy
  // creation and redeploy content updates.
  updateContent: "publish/createDeployment",
  setEnvVars: "publish/setEnvVars",
  deployBundle: "publish/deployBundle",
  waitForTask: "publish/restoreEnv",
  validateDeployment: "publish/validateDeployment",
} as const satisfies Record<PublishStep, string>;

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

function makeMessage(
  type: EventSubscriptionTarget,
  data: Record<string, string> = {},
  errCode?: ErrorCode,
): EventStreamMessage {
  const msg: EventStreamMessage = {
    type,
    time: new Date().toISOString(),
    data: { message: "", ...data },
  };
  if (errCode) {
    msg.errCode = errCode;
  }
  return msg;
}

/**
 * Inject a synthetic EventStreamMessage into the event stream so that
 * the Publishing Log tree view and raw log viewer pick it up.
 */
function injectStageEvent(
  stream: EventStream,
  step: PublishStep,
  suffix: PublishEvent["status"],
  data: Record<string, string> = {},
): void {
  stream.injectMessage(
    makeMessage(`${stepToEventPrefix[step]}/${suffix}`, data),
  );
}

/**
 * Run a TS-orchestrated deployment inside a VSCode progress notification,
 * feeding events into the Publishing Log tree view via the EventStream.
 */
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

      // Inject publish/start — resets the logs tree and triggers
      // HomeView's onPublishStart() via the stream handler.
      stream.injectMessage(
        makeMessage("publish/start", {
          server: serverUrl,
          title,
          productType: "connect",
        }),
      );

      // Capture classified error info from step failure events so we can
      // include them on the top-level publish/failure event for the logs
      // tree view. Mirrors Go's emitErrorEvents which propagates the
      // AgentError code and message to publish/failure.
      let lastLogsUrl: string | undefined;
      let lastDashboardUrl: string | undefined;
      let lastErrCode: ErrorCode | undefined;
      let lastClassifiedMessage: string | undefined;

      try {
        // Track which SSE stage waitForTask logs belong to.
        // Starts as restoreEnv, transitions to runContent when a launch
        // pattern is detected — mirroring Go's eventOpFromLogLine().
        let waitForTaskStage: "publish/restoreEnv" | "publish/runContent" =
          "publish/restoreEnv";

        const result = await deploy((event) => {
          if (event.status === "start") {
            progress.report({ message: stepLabels[event.step] });
            injectStageEvent(stream, event.step, "start", event.data);
          } else if (event.status === "success") {
            if (event.step === "waitForTask") {
              // Close whichever stage is active (restoreEnv or runContent).
              stream.injectMessage(makeMessage(`${waitForTaskStage}/success`));
            } else {
              injectStageEvent(stream, event.step, "success", event.data);
            }
          } else if (event.status === "failure") {
            // Capture classified error info for use in publish/failure.
            if (event.data?.logsUrl) {
              lastLogsUrl = event.data.logsUrl;
            }
            if (event.data?.dashboardUrl) {
              lastDashboardUrl = event.data.dashboardUrl;
            }
            lastErrCode = event.errCode;
            lastClassifiedMessage = event.message;

            const failData: Record<string, string> = {
              message: event.message || "Unknown error",
              ...event.data,
            };

            if (event.step === "waitForTask") {
              // Fail whichever stage is active (restoreEnv or runContent).
              stream.injectMessage(
                makeMessage(
                  `${waitForTaskStage}/failure`,
                  failData,
                  event.errCode,
                ),
              );
            } else {
              stream.injectMessage(
                makeMessage(
                  `${stepToEventPrefix[event.step]}/failure`,
                  failData,
                  event.errCode,
                ),
              );
            }
          } else if (event.status === "log") {
            if (event.step === "waitForTask") {
              const msg = event.message || "";

              // Detect the transition from env restore to content launch.
              if (launchPattern.test(msg) || staticPattern.test(msg)) {
                if (waitForTaskStage === "publish/restoreEnv") {
                  // Close restoreEnv and open runContent in the logs tree.
                  stream.injectMessage(
                    makeMessage("publish/restoreEnv/success"),
                  );
                  stream.injectMessage(makeMessage("publish/runContent/start"));
                  waitForTaskStage = "publish/runContent";
                }
              }

              // Detect package installations for progress label updates.
              const pkgEvent = packageEventFromLogLine(msg);
              if (pkgEvent) {
                stream.injectMessage(
                  makeMessage(`${waitForTaskStage}/status`, pkgEvent),
                );
              }

              stream.injectMessage(
                makeMessage(`${waitForTaskStage}/log`, {
                  message: msg,
                  level: "INFO",
                }),
              );
            } else {
              // Non-waitForTask log events (e.g., validateDeployment logs)
              injectStageEvent(stream, event.step, "log", {
                message: event.message || "",
                ...event.data,
              });
            }
          }
        }, controller.signal);

        // Guard against cancel/success race: if the user canceled while
        // deploy was completing, the cancel handler already injected
        // publish/failure — don't also inject publish/success.
        if (controller.signal.aborted) {
          return;
        }

        // Inject publish/success — triggers HomeView's onPublishSuccess()
        // via the stream handler.
        stream.injectMessage(
          makeMessage("publish/success", {
            dashboardUrl: result.dashboardUrl,
            directUrl: result.directUrl,
            logsUrl: result.logsUrl,
            contentId: result.contentId,
            serverUrl,
            productType: "connect",
          }),
        );

        // Show the "View" prompt without awaiting — let the progress
        // notification close immediately (matching the Go path behavior).
        showSuccessNotification(result.dashboardUrl);
      } catch (err) {
        // CanceledError is not a real failure — the cancellation handler
        // already injected publish/failure with canceled: "true".
        // Also check signal.aborted to catch in-flight abort errors
        // (axios CanceledError) that connectPublish may have normalized.
        if (err instanceof CanceledError || controller.signal.aborted) {
          return;
        }

        // Use the classified message from the step failure event if
        // available, falling back to the raw thrown error message.
        // Mirrors Go's emitErrorEvents which uses agentErr.Message.
        const rawMessage = err instanceof Error ? err.message : String(err);
        const message = lastClassifiedMessage || rawMessage;

        // Inject publish/failure — triggers HomeView's onPublishFailure()
        // via the stream handler. Include URLs when available so the logs
        // tree view can render a clickable "View Connect Logs" link.
        const failureData: Record<string, string> = {
          message,
          productType: "connect",
        };
        if (lastLogsUrl) {
          failureData.logsUrl = lastLogsUrl;
        }
        if (lastDashboardUrl) {
          failureData.dashboardUrl = lastDashboardUrl;
        }
        stream.injectMessage(
          makeMessage("publish/failure", failureData, lastErrCode),
        );
      } finally {
        onComplete();
      }
    },
  );
}

/**
 * Detect R/Python package installation lines and return data for
 * publish/restoreEnv/status events. Mirrors Go's packageEventFromLogLine().
 */
function packageEventFromLogLine(
  line: string,
): Record<string, string> | undefined {
  let match: RegExpMatchArray | null;

  match = rPackagePattern.exec(line);
  if (match?.[1] && match[2]) {
    return {
      name: match[1],
      version: match[2],
      runtime: "r",
      status: "download-and-install",
    };
  }

  match = pythonCollectingPattern.exec(line);
  if (match?.[1] && match[2]) {
    return {
      name: match[1],
      version: match[2],
      runtime: "python",
      status: "download",
    };
  }

  match = pythonInstallingPattern.exec(line);
  if (match?.[1]) {
    return {
      name: match[1],
      version: match[2] ?? "",
      runtime: "python",
      status: "install",
    };
  }

  return undefined;
}

async function showSuccessNotification(dashboardUrl: string): Promise<void> {
  const visitOption = "View";
  const selection = await window.showInformationMessage(
    "Deployment was successful",
    visitOption,
  );
  if (selection === visitOption && dashboardUrl) {
    const uri = Uri.parse(dashboardUrl, true);
    await env.openExternal(uri);
  }
}
