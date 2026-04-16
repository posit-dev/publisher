// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { isAxiosError } from "axios";

import {
  type ConnectCloudAPI,
  type ContentResponse,
  ContentID,
  PublishResult as CloudPublishResult,
  watchCloudLogs,
} from "@posit-dev/connect-cloud-api";

import type { ConfigurationDetails } from "../api/types/configurations";
import type { ServerType } from "../api/types/contentRecords";
import type { PositronRSettings } from "../api/types/positron";
import type { ErrorCode } from "../utils/errorTypes";
import { logger } from "../logging";
import { DEFAULT_PYTHON_PACKAGE_FILE } from "../constants";
import { fileExistsAt } from "../interpreters/fsUtils";
import { generateRequirements } from "../interpreters/pythonDependencySources";
import { forceProductTypeCompliance } from "../toml/configCompliance";
import { getFilenames } from "../bundler/manifest";
import { readPythonRequirements } from "./dependencies";

import {
  CanceledError,
  buildManifest,
  buildBundleArchive,
  writePublishRecord,
  setRecordContentInfo,
  lockfileToDeploymentRenv,
  DEPLOYMENT_SCHEMA_URL,
  type PublishEvent,
  type PublishRecord,
  type PublishResult,
} from "./publishShared";

import {
  type CloudCredentialInfo,
  buildCreateContentRequest,
  buildUpdateContentRequest,
  getCloudContentInfo,
  getCloudUIURL,
  getAccess,
} from "./cloudContentRequest";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CloudPublishStep =
  | "createManifest"
  | "createBundle"
  | "createContent"
  | "updateContent"
  | "initiatePublish"
  | "uploadBundle"
  | "watchLogs"
  | "awaitCompletion";

export type CloudPublishEvent = {
  step: CloudPublishStep;
  status: "start" | "success" | "failure" | "log";
  message?: string;
  errCode?: ErrorCode;
  data?: Record<string, string>;
};

export type ConnectCloudPublishOptions = {
  api: ConnectCloudAPI;
  projectDir: string;
  saveName: string;
  config: ConfigurationDetails;
  configName: string;
  serverType: ServerType;
  credential: CloudCredentialInfo;
  existingContentId?: ContentID;
  existingCreatedAt?: string;
  secrets?: Record<string, string>;
  rPath?: string;
  positronR?: PositronRSettings;
  clientVersion: string;
  onProgress: (event: CloudPublishEvent) => void;
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function connectCloudPublish({
  api,
  projectDir,
  saveName,
  config: rawConfig,
  configName,
  serverType,
  credential,
  existingContentId,
  existingCreatedAt,
  secrets,
  rPath,
  positronR,
  clientVersion,
  onProgress,
  signal,
}: ConnectCloudPublishOptions): Promise<PublishResult> {
  // Work on a copy so we don't mutate the caller's config
  const config = structuredClone(rawConfig);
  forceProductTypeCompliance(config);

  const deploymentPath = path.join(
    projectDir,
    ".posit",
    "publish",
    "deployments",
    `${saveName}.toml`,
  );

  // Cloud server URL for the deployment record
  const serverUrl = getCloudUIURL(credential.environment);

  // Mutable record state — written to disk at key points
  const record: PublishRecord = {
    schema: DEPLOYMENT_SCHEMA_URL,
    serverType,
    serverUrl,
    clientVersion,
    createdAt: existingCreatedAt || new Date().toISOString(),
    type: config.type,
    configName,
    config,
    // Required by schema when server_type is "connect_cloud"
    connectCloud: { accountName: credential.accountName },
  };

  let contentId = existingContentId;

  // If redeploying, populate URLs from existing content ID
  if (contentId) {
    const urls = getCloudContentInfo(credential, contentId);
    setRecordContentInfo(
      record,
      contentId,
      urls.dashboardURL,
      urls.directURL,
      urls.logsURL,
    );
  }

  // Write initial deployment record
  await writePublishRecord(deploymentPath, record);

  let lastStep: CloudPublishStep | undefined;

  /** Check if canceled; if so, write dismissedAt and throw CanceledError. */
  async function throwIfCanceled(): Promise<void> {
    if (signal?.aborted) {
      record.dismissedAt = new Date().toISOString();
      record.deploymentError = undefined;
      try {
        await writePublishRecord(deploymentPath, record);
      } catch {
        // Don't mask cancellation
      }
      throw new CanceledError();
    }
  }

  try {
    await throwIfCanceled();

    // Step 1: Build manifest with R/Python packages
    lastStep = "createManifest";
    onProgress({ step: "createManifest", status: "start" });
    onProgress({
      step: "createManifest",
      status: "log",
      message: "Collecting package descriptions",
    });
    const { manifest, lockfilePath, lockfile } = await buildManifest(
      projectDir,
      config,
      rPath,
      positronR,
      onProgress as (event: PublishEvent) => void,
    );

    // Log local runtime versions (mirrors Go's logDeploymentVersions)
    onProgress({
      step: "createManifest",
      status: "log",
      message: manifest.quarto?.version
        ? `Local Quarto version ${manifest.quarto.version}`
        : "Local Quarto not in use",
    });
    onProgress({
      step: "createManifest",
      status: "log",
      // manifest.platform holds the R version in the Posit manifest spec
      message: manifest.platform
        ? `Local R version ${manifest.platform}`
        : "Local R not in use",
    });
    onProgress({
      step: "createManifest",
      status: "log",
      message: manifest.python?.version
        ? `Local Python version ${manifest.python.version}`
        : "Local Python not in use",
    });

    onProgress({ step: "createManifest", status: "success" });

    await throwIfCanceled();

    // Step 2: Create bundle archive (with missing-package-file check)
    lastStep = "createBundle";
    onProgress({ step: "createBundle", status: "start" });
    onProgress({
      step: "createBundle",
      status: "log",
      message: "Preparing files",
    });

    let generatedRequirements: string[] | undefined;

    if (config.python) {
      const packageFile =
        config.python.packageFile || DEFAULT_PYTHON_PACKAGE_FILE;
      const packageFilePath = path.join(projectDir, packageFile);
      const packageFileExists = await fileExistsAt(packageFilePath);

      if (!packageFileExists && packageFile === DEFAULT_PYTHON_PACKAGE_FILE) {
        // No default requirements file on disk — try generating from lockfiles
        const generated = await generateRequirements(projectDir);
        if (generated !== null) {
          generatedRequirements = generated;
          // Patch manifest to reflect the synthetic file we'll inject
          if (manifest.python?.package_manager) {
            manifest.python.package_manager.package_file =
              DEFAULT_PYTHON_PACKAGE_FILE;
          }
        } else {
          throw new Error(
            `Missing dependency file ${packageFile}. ` +
              `This file must be included in the deployment.`,
          );
        }
      } else if (!packageFileExists) {
        throw new Error(
          `Missing dependency file ${packageFile}. ` +
            `This file must be included in the deployment.`,
        );
      }
    }

    // Build synthetic files map if requirements were generated from lockfiles
    let syntheticFiles: Map<string, Buffer> | undefined;
    if (generatedRequirements && config.python) {
      const packageFile =
        config.python.packageFile || DEFAULT_PYTHON_PACKAGE_FILE;
      syntheticFiles = new Map<string, Buffer>();
      syntheticFiles.set(
        packageFile,
        Buffer.from(generatedRequirements.join("\n") + "\n"),
      );
    }

    const { bundle, manifest: finalManifest } = await buildBundleArchive(
      projectDir,
      config,
      manifest,
      lockfilePath,
      (event) => {
        switch (event.kind) {
          case "sourceDir":
            onProgress({
              step: "createBundle",
              status: "log",
              message: "Creating bundle from source directory",
              data: { sourceDir: event.sourceDir },
            });
            logger.info(
              `Creating bundle from directory source_dir=${event.sourceDir}`,
            );
            break;
          case "file":
            logger.debug(`Adding file path=${event.path} size=${event.size}`);
            break;
          case "summary":
            onProgress({
              step: "createBundle",
              status: "log",
              message: "Bundle includes",
              data: {
                files: String(event.files),
                totalBytes: String(event.totalBytes),
              },
            });
            logger.info(
              `Bundle created files=${event.files} total_bytes=${event.totalBytes}`,
            );
            break;
        }
      },
      syntheticFiles,
    );
    record.files = getFilenames(finalManifest);

    // Record dependencies in the deployment record
    if (generatedRequirements) {
      record.requirements = generatedRequirements;
    } else {
      const pythonReqs = await readPythonRequirements(
        projectDir,
        config.python,
      );
      if (pythonReqs) {
        record.requirements = pythonReqs;
      }
    }
    if (lockfile) {
      record.renv = lockfileToDeploymentRenv(lockfile);
    }
    onProgress({
      step: "createBundle",
      status: "log",
      message: "Done preparing files",
    });
    onProgress({
      step: "createBundle",
      status: "success",
      data: { filename: "bundle.tar.gz" },
    });

    await throwIfCanceled();

    // Step 3: Create or update content
    let content: ContentResponse;

    if (!contentId) {
      // First deploy: create new content
      lastStep = "createContent";
      onProgress({
        step: "createContent",
        status: "start",
        data: { saveName },
      });
      onProgress({
        step: "createContent",
        status: "log",
        message: "Creating new Connect Cloud deployment",
      });

      const access = await getAccess(
        api,
        true,
        credential.accountId,
        undefined,
        config.connectCloud?.accessControl,
      );
      if (!access) {
        throw new Error("access control is required for first deploy");
      }
      const createRequest = buildCreateContentRequest(
        config,
        saveName,
        secrets,
        credential.accountId,
        access,
      );

      content = await api.createContent(createRequest);
      contentId = content.id;

      const urls = getCloudContentInfo(credential, contentId);
      setRecordContentInfo(
        record,
        contentId,
        urls.dashboardURL,
        urls.directURL,
        urls.logsURL,
      );
      await writePublishRecord(deploymentPath, record);

      onProgress({
        step: "createContent",
        status: "log",
        message: "Created deployment",
        data: { content_id: contentId },
      });
      onProgress({
        step: "createContent",
        status: "success",
        data: { contentId, saveName },
      });
    } else {
      // Redeploy: update existing content
      lastStep = "updateContent";
      onProgress({
        step: "updateContent",
        status: "start",
        data: { contentId, saveName },
      });
      onProgress({
        step: "updateContent",
        status: "log",
        message: "Determining content settings",
      });

      const access = await getAccess(
        api,
        false,
        credential.accountId,
        contentId,
        config.connectCloud?.accessControl,
      );
      const updateRequest = buildUpdateContentRequest(
        config,
        saveName,
        secrets,
        contentId,
        access,
      );

      onProgress({
        step: "updateContent",
        status: "log",
        message: "Updating content settings",
      });
      content = await api.updateContent(updateRequest);

      onProgress({
        step: "updateContent",
        status: "log",
        message: "Updated content settings",
      });
      onProgress({ step: "updateContent", status: "success" });
    }

    // Validate that the server returned a revision — needed for upload URL
    // and bundle ID. Check early so we don't waste a publishContent call.
    if (!content.next_revision) {
      throw new Error("Server did not return a revision for this content");
    }
    const uploadUrl = content.next_revision.source_bundle_upload_url;
    const bundleId = content.next_revision.source_bundle_id;

    await throwIfCanceled();

    // Step 4: Initiate publish (BEFORE upload — matching Go)
    lastStep = "initiatePublish";
    onProgress({ step: "initiatePublish", status: "start" });
    onProgress({
      step: "initiatePublish",
      status: "log",
      message: "Initiating publish of content",
    });

    await api.publishContent(contentId);

    onProgress({
      step: "initiatePublish",
      status: "log",
      message: "Publish initiated",
    });
    onProgress({ step: "initiatePublish", status: "success" });

    await throwIfCanceled();

    // Step 5: Upload bundle
    lastStep = "uploadBundle";
    onProgress({ step: "uploadBundle", status: "start" });
    onProgress({
      step: "uploadBundle",
      status: "log",
      message: "Uploading files",
    });

    await api.uploadBundle(uploadUrl, new Uint8Array(bundle));

    record.bundleId = bundleId;
    await writePublishRecord(deploymentPath, record);

    onProgress({
      step: "uploadBundle",
      status: "log",
      message: "Done uploading files",
      data: { bundle_id: bundleId },
    });
    onProgress({ step: "uploadBundle", status: "success" });

    await throwIfCanceled();

    // Steps 6 & 7: Watch logs + await completion (concurrent)
    lastStep = "watchLogs";
    onProgress({ step: "watchLogs", status: "start" });
    onProgress({
      step: "watchLogs",
      status: "log",
      message: "Getting content logs...",
    });

    // Re-fetch content to get fresh revision with log channel
    content = await api.getContent(contentId);
    if (!content.next_revision) {
      throw new Error("Server did not return a revision after publish");
    }
    const revisionId = content.next_revision.id;
    const logChannel = content.next_revision.publish_log_channel;

    // Get auth token for log streaming
    const authResponse = await api.getAuthorization({
      resource_type: "log_channel",
      resource_id: logChannel,
      permission: "revision.logs:read",
    });
    if (!authResponse.authorized || !authResponse.token) {
      throw new Error("Not authorized to access log channel");
    }

    // Start log streaming with a separate AbortController
    const logAbortController = new AbortController();
    const logPromise = watchCloudLogs({
      environment: credential.environment,
      logChannel,
      authToken: authResponse.token,
      onLog: (line) => {
        onProgress({ step: "watchLogs", status: "log", message: line.message });
      },
      signal: logAbortController.signal,
    }).catch((err) => {
      // Log streaming errors are non-fatal (logs may close before we cancel)
      logger.debug("Log streaming error:", err);
    });

    // Poll for completion
    lastStep = "awaitCompletion";
    onProgress({
      step: "awaitCompletion",
      status: "log",
      message: "Waiting for publish to complete",
      data: { revision_id: revisionId },
    });

    let publishSucceeded = false;
    try {
      while (true) {
        await throwIfCanceled();

        const revision = await api.getRevision(revisionId);

        if (revision.publish_result !== null) {
          if (revision.publish_result === CloudPublishResult.Failure) {
            throw new Error(
              `${revision.publish_error}: ${revision.publish_error_details}`,
            );
          }

          // Success case
          onProgress({
            step: "awaitCompletion",
            status: "log",
            message: "Publish completed successfully",
          });
          publishSucceeded = true;
          break;
        }

        // Wait 1 second before polling again (matching Go)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      if (publishSucceeded) {
        // Give logs 5 seconds to flush (matching Go's grace period)
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      // Cancel log stream
      logAbortController.abort();
      await logPromise;
    }

    onProgress({ step: "watchLogs", status: "success" });

    // Server log phase is closed — clear lastStep so that if writePublishRecord
    // throws, the catch block won't emit a contradictory server-log failure
    // after we already emitted success.
    lastStep = undefined;

    // Write completed record (deployedAt is set by writePublishRecord)
    await writePublishRecord(deploymentPath, record);

    return {
      contentId,
      dashboardUrl: record.dashboardUrl!,
      directUrl: record.directUrl!,
      logsUrl: record.logsUrl!,
      bundleId,
    };
  } catch (err) {
    // Cancellation is not an error — dismissedAt was already written by throwIfCanceled
    if (err instanceof CanceledError) {
      throw err;
    }

    // In-flight abort: when signal fires during an API call, axios throws
    // its own CanceledError (not our CanceledError). Normalize to our
    // cancellation path so the deployment record gets dismissedAt, not
    // a deployment_error.
    if (signal?.aborted) {
      record.dismissedAt = new Date().toISOString();
      record.deploymentError = undefined;
      try {
        await writePublishRecord(deploymentPath, record);
      } catch {
        // Don't mask cancellation
      }
      throw new CanceledError();
    }

    // Classify the error for both the deployment record and UI events
    const classified = classifyCloudDeploymentError(lastStep, err);

    // Emit failure event so progress consumers know which step failed
    if (lastStep) {
      const failData: Record<string, string> = {};
      // Include URLs when we have a content ID so the UI can link to logs
      if (record.logsUrl) {
        failData.logsUrl = record.logsUrl;
      }
      if (record.dashboardUrl) {
        failData.dashboardUrl = record.dashboardUrl;
      }
      onProgress({
        step: lastStep,
        status: "failure",
        message: classified.message,
        errCode: classified.code,
        data: failData,
      });
    }

    // Record the error in the deployment file
    record.deploymentError = {
      code: classified.code,
      message: classified.message,
      operation: "publish",
    };
    try {
      await writePublishRecord(deploymentPath, record);
    } catch {
      // Don't mask the original error
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Maps a caught error to a deployment record error code and user-facing message.
 * Mirrors the Connect error classifier but adapted for Cloud-specific errors.
 */
function classifyCloudDeploymentError(
  lastStep: CloudPublishStep | undefined,
  err: unknown,
): { code: ErrorCode; message: string } {
  const fallbackMessage = err instanceof Error ? err.message : String(err);

  // Authentication failures (401 from any step)
  if (isAxiosError(err) && err.response?.status === 401) {
    return {
      code: "authFailedErr",
      message: "Authentication failed. Check your credentials.",
    };
  }

  // Missing dependency file (thrown during bundle creation)
  if (
    lastStep === "createBundle" &&
    err instanceof Error &&
    err.message.includes("Missing dependency file")
  ) {
    return {
      code: "requirementsFileReadingError",
      message: err.message,
    };
  }

  // Revision failure (server-side deploy failure)
  if (
    lastStep === "awaitCompletion" &&
    err instanceof Error &&
    !isAxiosError(err)
  ) {
    return {
      code: "deployFailed",
      message: err.message,
    };
  }

  // Other HTTP errors — include the full response body so the user sees the
  // same detail the Go path surfaces via HTTPError.Error().
  if (isAxiosError(err) && err.response) {
    const { status, data } = err.response;
    const body = typeof data === "string" ? data : JSON.stringify(data ?? "");
    return {
      code: "unknown",
      message: `Unexpected response from the server (${status}: ${body})`,
    };
  }

  return { code: "unknown", message: fallbackMessage };
}
