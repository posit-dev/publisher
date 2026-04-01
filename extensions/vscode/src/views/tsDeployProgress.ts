// Copyright (C) 2026 by Posit Software, PBC.

import { ProgressLocation, Uri, env, window } from "vscode";
import type {
  PublishEvent,
  PublishResult,
  PublishStep,
} from "src/publish/connectPublish";
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
// Steps not listed here have no corresponding stage in the logs tree view.
const stepToEventPrefix: Partial<Record<PublishStep, string>> = {
  // createManifest is intentionally omitted — it maps to
  // publish/getRPackageDescriptions which is R-specific in the Go path.
  // Emitting it for Python-only deploys would create a spurious tree node.
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
};

export type TsDeployProgressOptions = {
  deploy: (onProgress: (event: PublishEvent) => void) => Promise<PublishResult>;
  /** Called after deployment completes (success or failure) for cleanup like refreshing content records. */
  onComplete: () => void;
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
  suffix: "start" | "success" | "failure" | "log",
  data: Record<string, string> = {},
): void {
  const prefix = stepToEventPrefix[step];
  if (!prefix) {
    return;
  }
  // Safe: every prefix in stepToEventPrefix combined with our suffix literals
  // produces a valid EventSubscriptionTarget (e.g. "publish/createBundle/start").
  const type = `${prefix}/${suffix}` as EventSubscriptionTarget;
  stream.injectMessage(makeMessage(type, data));
}

/**
 * Run a TS-orchestrated deployment inside a VSCode progress notification,
 * feeding events into the Publishing Log tree view via the EventStream.
 */
export function runTsDeployWithProgress(
  options: TsDeployProgressOptions,
): void {
  const { deploy, onComplete, stream, serverUrl, title } = options;

  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Deploying your project",
      cancellable: false,
    },
    async (progress) => {
      // Inject publish/start — resets the logs tree and triggers
      // HomeView's onPublishStart() via the stream handler.
      stream.injectMessage(
        makeMessage("publish/start", {
          server: serverUrl,
          title,
          productType: "connect",
        }),
      );

      // Capture URLs from step failure events so we can include them
      // on the top-level publish/failure event for the logs tree view.
      let lastLogsUrl: string | undefined;
      let lastDashboardUrl: string | undefined;

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
              stream.injectMessage(
                makeMessage(
                  `${waitForTaskStage}/success` as EventSubscriptionTarget,
                ),
              );
            } else {
              injectStageEvent(stream, event.step, "success", event.data);
            }
          } else if (event.status === "failure") {
            // Capture URLs from the failure event for use in publish/failure.
            if (event.data?.logsUrl) {
              lastLogsUrl = event.data.logsUrl;
            }
            if (event.data?.dashboardUrl) {
              lastDashboardUrl = event.data.dashboardUrl;
            }

            const failData: Record<string, string> = {
              message: event.message || "Unknown error",
              ...event.data,
            };

            if (event.step === "waitForTask") {
              // Fail whichever stage is active (restoreEnv or runContent).
              stream.injectMessage(
                makeMessage(
                  `${waitForTaskStage}/failure` as EventSubscriptionTarget,
                  failData,
                  event.errCode,
                ),
              );
            } else {
              const prefix = stepToEventPrefix[event.step];
              if (prefix) {
                const type = `${prefix}/failure` as EventSubscriptionTarget;
                stream.injectMessage(
                  makeMessage(type, failData, event.errCode),
                );
              }
            }
          } else if (event.status === "log") {
            if (event.step === "waitForTask") {
              const msg = event.message || "";

              // Detect the transition from env restore to content launch.
              if (launchPattern.test(msg) || staticPattern.test(msg)) {
                if (waitForTaskStage === "publish/restoreEnv") {
                  // Close restoreEnv and open runContent in the logs tree.
                  stream.injectMessage(
                    makeMessage(
                      "publish/restoreEnv/success" as EventSubscriptionTarget,
                    ),
                  );
                  stream.injectMessage(
                    makeMessage(
                      "publish/runContent/start" as EventSubscriptionTarget,
                    ),
                  );
                  waitForTaskStage = "publish/runContent";
                }
              }

              // Detect package installations for progress label updates.
              const pkgEvent = packageEventFromLogLine(msg);
              if (pkgEvent) {
                stream.injectMessage(
                  makeMessage(
                    `${waitForTaskStage}/status` as EventSubscriptionTarget,
                    pkgEvent,
                  ),
                );
              }

              const type = `${waitForTaskStage}/log` as EventSubscriptionTarget;
              stream.injectMessage(
                makeMessage(type, { message: msg, level: "INFO" }),
              );
            } else {
              // Non-waitForTask log events (e.g., validateDeployment logs)
              injectStageEvent(stream, event.step, "log", {
                message: event.message || "",
                ...event.data,
              });
            }
          }
        });

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
        const message = err instanceof Error ? err.message : String(err);

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
        stream.injectMessage(makeMessage("publish/failure", failureData));
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
