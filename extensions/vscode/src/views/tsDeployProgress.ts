// Copyright (C) 2026 by Posit Software, PBC.

import { ProgressLocation, Uri, env, window } from "vscode";
import type {
  PublishEvent,
  PublishResult,
  PublishStep,
} from "src/publish/connectPublish";

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

export type TsDeployCallbacks = {
  onStart: () => void;
  onSuccess: () => void;
  onFailure: (message: string) => void;
  onComplete: () => void;
};

/**
 * Run a TS-orchestrated deployment inside a VSCode progress notification.
 *
 * @param deploy    Async function that performs the deployment and calls
 *                  the provided `onProgress` callback at each step.
 * @param callbacks Lifecycle hooks for webview state transitions and cleanup.
 */
export function runTsDeployWithProgress(
  deploy: (onProgress: (event: PublishEvent) => void) => Promise<PublishResult>,
  callbacks: TsDeployCallbacks,
): void {
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Deploying your project",
      cancellable: false,
    },
    async (progress) => {
      callbacks.onStart();

      try {
        const result = await deploy((event) => {
          if (event.status === "start") {
            progress.report({ message: stepLabels[event.step] });
          }
        });

        progress.report({ message: "Deployment was successful" });
        callbacks.onSuccess();

        const visitOption = "View";
        const selection = await window.showInformationMessage(
          "Deployment was successful",
          visitOption,
        );
        if (selection === visitOption && result.dashboardUrl) {
          const uri = Uri.parse(result.dashboardUrl, true);
          await env.openExternal(uri);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        callbacks.onFailure(message);
        window.showErrorMessage(`Deployment failed: ${message}`);
      } finally {
        callbacks.onComplete();
      }
    },
  );
}
