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

export type TsDeployCallbacks = {
  onStart: () => void;
  onSuccess: () => void;
  onFailure: (message: string) => void;
  onComplete: () => void;
};

export type TsDeployProgressOptions = {
  deploy: (onProgress: (event: PublishEvent) => void) => Promise<PublishResult>;
  callbacks: TsDeployCallbacks;
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
  const { deploy, callbacks, stream, serverUrl, title } = options;

  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Deploying your project",
      cancellable: false,
    },
    async (progress) => {
      // Inject the top-level publish/start so the logs tree resets and opens
      stream.injectMessage(
        makeMessage("publish/start", {
          server: serverUrl,
          title,
          productType: "connect",
        }),
      );

      callbacks.onStart();

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

        callbacks.onSuccess();

        // Inject publish/success for the logs tree
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
        callbacks.onFailure(message);

        // Inject publish/failure for the logs tree
        stream.injectMessage(
          makeMessage("publish/failure", {
            message,
            productType: "connect",
          }),
        );

        window.showErrorMessage(`Deployment failed: ${message}`);
      } finally {
        callbacks.onComplete();
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
