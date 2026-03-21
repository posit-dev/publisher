// Copyright (C) 2026 by Posit Software, PBC.

import { ProgressLocation, Uri, env, window } from "vscode";
import type {
  PublishEvent,
  PublishResult,
  PublishStep,
} from "src/publish/connectPublish";
import type { EventStream } from "src/events";
import type { EventStreamMessage, EventSubscriptionTarget } from "src/api";

const stepLabels: Record<PublishStep, string> = {
  createManifest: "Preparing manifest…",
  preflight: "Verifying credentials…",
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
  preflight: "publish/checkCapabilities",
  createDeployment: "publish/createDeployment",
  createBundle: "publish/createBundle",
  uploadBundle: "publish/uploadBundle",
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
): EventStreamMessage {
  return {
    type,
    time: new Date().toISOString(),
    data: { message: "", ...data },
  };
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

      try {
        const result = await deploy((event) => {
          if (event.status === "start") {
            progress.report({ message: stepLabels[event.step] });
            injectStageEvent(stream, event.step, "start");
          } else if (event.status === "success") {
            injectStageEvent(stream, event.step, "success");
          } else if (event.status === "failure") {
            injectStageEvent(stream, event.step, "failure", {
              message: event.message || "Unknown error",
            });
          } else if (event.status === "log") {
            injectStageEvent(stream, event.step, "log", {
              message: event.message || "",
              level: "INFO",
            });
          }
        });

        // Inject publish/success — triggers HomeView's onPublishSuccess()
        // via the stream handler.
        stream.injectMessage(
          makeMessage("publish/success", {
            dashboardUrl: result.dashboardUrl,
            directUrl: result.directUrl,
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
        // via the stream handler.
        stream.injectMessage(
          makeMessage("publish/failure", {
            message,
            productType: "connect",
          }),
        );

        window.showErrorMessage(`Deployment failed: ${message}`);
      } finally {
        onComplete();
      }
    },
  );
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
