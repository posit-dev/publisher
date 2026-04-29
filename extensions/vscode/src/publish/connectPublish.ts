// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { isAxiosError } from "axios";

import {
  ConnectAPI,
  ContentID,
  BundleID,
  TaskID,
} from "@posit-dev/connect-api";
import type { AllSettings } from "@posit-dev/connect-api";

import {
  ContentType,
  type ConfigurationDetails,
} from "../api/types/configurations";
import type { PositronRSettings } from "../api/types/positron";

import { appModeFromType, contentTypeFromAppMode } from "../bundler/appMode";
import { connectContentFromConfig } from "../bundler/connectContentFromConfig";
import { getFilenames } from "../bundler/manifest";

import { readPythonRequirements } from "./dependencies";
import {
  CanceledError,
  buildManifest,
  buildBundleArchive,
  mergeEnvVars,
  writePublishRecord,
  setRecordContentInfo,
  lockfileToDeploymentRenv,
  DEPLOYMENT_SCHEMA_URL,
  type PublishEvent,
  type PublishStep,
  type PublishResult,
  type PublishRecord,
} from "./publishShared";

import { forceProductTypeCompliance } from "../toml/configCompliance";
import { getDashboardUrl, getDirectUrl, getLogsUrl } from "../toml/urlHelpers";
import { DEFAULT_PYTHON_PACKAGE_FILE } from "../constants";
import { fileExistsAt } from "../interpreters/fsUtils";
import { generateRequirements } from "../interpreters/pythonDependencySources";
import { logger } from "../logging";
import type { ErrorCode } from "../utils/errorTypes";
import type { ServerType } from "../api/types/contentRecords";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ConnectPublishOptions = {
  /** Connected Connect API client. */
  api: ConnectAPI;
  /** Absolute path to the project directory. */
  projectDir: string;
  /** Name under which the deployment record is saved. */
  saveName: string;
  /** Deployment configuration. */
  config: ConfigurationDetails;
  /** Name of the config file (without path). */
  configName: string;
  /** Base URL of the Connect server. */
  serverUrl: string;
  /** Server type (connect or snowflake). */
  serverType: ServerType;
  /** Content ID from an existing deployment (redeploy), or undefined for first deploy. */
  existingContentId?: string;
  /** Preserved createdAt timestamp from an existing deployment record. */
  existingCreatedAt?: string;
  /** Secret environment variable values. */
  secrets?: Record<string, string>;
  /** Path to the R executable, if available. */
  rPath?: string;
  /** Positron IDE R settings (for repo URL computation). */
  positronR?: PositronRSettings;
  /** Publisher version string. */
  clientVersion: string;
  /** Progress callback invoked at each step boundary. */
  onProgress: (event: PublishEvent) => void;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function connectPublish({
  api,
  projectDir,
  saveName,
  config: rawConfig,
  configName,
  serverUrl,
  serverType,
  existingContentId,
  existingCreatedAt,
  secrets,
  rPath,
  positronR,
  clientVersion,
  onProgress,
  signal,
}: ConnectPublishOptions): Promise<PublishResult> {
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
  };

  let contentId = existingContentId;

  // If redeploying, populate URLs from existing content ID
  if (contentId) {
    setRecordContentInfo(
      record,
      contentId,
      getDashboardUrl(serverUrl, contentId),
      getDirectUrl(serverUrl, contentId),
      getLogsUrl(serverUrl, contentId),
    );
  }

  // Write initial deployment record
  await writePublishRecord(deploymentPath, record);

  let lastStep: PublishStep | undefined;

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
      onProgress,
    );

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

    // Step 2: Preflight — verify authentication
    lastStep = "preflight";
    onProgress({ step: "preflight", status: "start" });
    onProgress({
      step: "preflight",
      status: "log",
      message: "Checking configuration against server capabilities",
    });
    onProgress({
      step: "preflight",
      status: "log",
      message: "Testing authentication",
    });
    const { user } = await api.testAuthentication(signal);
    onProgress({
      step: "preflight",
      status: "log",
      message: "Publishing with credentials",
      data: { username: user.username, email: user.email },
    });

    // Validate configuration against known constraints
    if (config.description && config.description.length > 4096) {
      throw new Error("The description cannot be longer than 4096 characters.");
    }

    let generatedRequirements: string[] | undefined;

    if (config.python) {
      const packageFile =
        config.python.packageFile || DEFAULT_PYTHON_PACKAGE_FILE;
      const packageFilePath = path.join(projectDir, packageFile);
      const packageFileExists = await fileExistsAt(packageFilePath);

      if (packageFileExists) {
        // Check that the file is included in the configured file patterns.
        // Uses suffix matching, not glob evaluation. When the file list is empty
        // the loop produces no match, so requirementsIsIncluded stays false.
        const filePatterns = config.files ?? [];
        const isIncluded = filePatterns.some((pattern) =>
          pattern.endsWith(packageFile),
        );
        if (!isIncluded) {
          throw new Error(
            `Missing dependency file ${packageFile}. ` +
              `This file must be included in the deployment.`,
          );
        }
      } else if (packageFile === DEFAULT_PYTHON_PACKAGE_FILE) {
        // No default requirements file on disk — try generating from lockfiles.
        // Only fall back for the default file name; non-default files are
        // explicitly configured and should not be silently substituted.
        const generated = await generateRequirements(projectDir);
        if (generated !== null) {
          generatedRequirements = generated;
          // The manifest was built before preflight, so its package_file
          // reflects the config's original empty value. Patch it to match
          // the synthetic file we'll inject into the bundle.
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
      } else {
        throw new Error(
          `Missing dependency file ${packageFile}. ` +
            `This file must be included in the deployment.`,
        );
      }
    }

    // Fetch server settings and validate config against capabilities
    onProgress({
      step: "preflight",
      status: "log",
      message: "Checking server capabilities",
    });
    const settings = await api.getSettings(
      appModeFromType(config.type),
      signal,
    );
    checkServerSettings(settings, config);

    // Verify existing content when redeploying
    if (contentId) {
      onProgress({
        step: "preflight",
        status: "log",
        message: "Verifying existing content",
        data: { content_id: contentId },
      });

      let existing;
      try {
        const resp = await api.contentDetails(ContentID(contentId), signal);
        existing = resp.data;
      } catch (err) {
        logger.debug(`contentDetails failed for ${contentId}:`, err);
        if (isAxiosError(err) && err.response?.status === 404) {
          throw new Error(
            `Cannot deploy content: ID ${contentId} - Content cannot be found.`,
          );
        }
        if (isAxiosError(err) && err.response?.status === 403) {
          throw new Error(
            `Cannot deploy content: ID ${contentId} - ` +
              `You may need to request collaborator permissions or verify the credentials in use.`,
          );
        }
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Cannot deploy content: ID ${contentId} - Unknown error: ${errMsg}`,
        );
      }

      onProgress({
        step: "preflight",
        status: "log",
        message: "Verifying content is not locked",
      });
      if (existing.locked) {
        throw new Error(
          `Content is locked, cannot deploy to it (content ID = ${contentId})`,
        );
      }

      onProgress({
        step: "preflight",
        status: "log",
        message: "Verifying app mode is the same",
      });
      const configAppMode = appModeFromType(config.type);
      if (
        existing.app_mode !== configAppMode &&
        existing.app_mode !== "unknown" &&
        existing.app_mode !== ""
      ) {
        throw new Error(
          `Content was previously deployed as '${contentTypeFromAppMode(existing.app_mode)}' ` +
            `but your configuration is set to '${config.type}'.`,
        );
      }
    }

    onProgress({
      step: "preflight",
      status: "log",
      message: "Configuration OK",
    });
    onProgress({
      step: "preflight",
      status: "success",
    });

    await throwIfCanceled();

    // Step 3: Create deployment on Connect (first deploy only)
    if (!contentId) {
      lastStep = "createNewDeployment";
      onProgress({
        step: "createNewDeployment",
        status: "start",
        data: { saveName },
      });
      onProgress({
        step: "createNewDeployment",
        status: "log",
        message: "Creating new deployment",
      });
      const { data: created } = await api.createDeployment(
        { name: "" },
        signal,
      );
      contentId = created.guid;
      setRecordContentInfo(
        record,
        contentId,
        getDashboardUrl(serverUrl, contentId),
        getDirectUrl(serverUrl, contentId),
        getLogsUrl(serverUrl, contentId),
      );
      onProgress({
        step: "createNewDeployment",
        status: "log",
        message: "Created deployment",
        data: { content_id: contentId },
      });
      onProgress({
        step: "createNewDeployment",
        status: "success",
        data: { contentId, saveName },
      });
    }

    await throwIfCanceled();

    // Step 4: Create bundle archive
    lastStep = "createBundle";
    onProgress({ step: "createBundle", status: "start" });
    onProgress({
      step: "createBundle",
      status: "log",
      message: "Preparing files",
    });

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

    // Step 5: Upload bundle
    lastStep = "uploadBundle";
    onProgress({ step: "uploadBundle", status: "start" });
    onProgress({
      step: "uploadBundle",
      status: "log",
      message: "Uploading files",
    });
    const { data: bundleDTO } = await api.uploadBundle(
      ContentID(contentId),
      new Uint8Array(bundle),
      signal,
    );
    const bundleId = BundleID(bundleDTO.id);
    record.bundleId = bundleDTO.id;
    record.bundleUrl = getBundleUrl(serverUrl, contentId, bundleDTO.id);
    await writePublishRecord(deploymentPath, record);
    onProgress({
      step: "uploadBundle",
      status: "log",
      message: "Done uploading files",
      data: { bundle_id: bundleDTO.id },
    });
    onProgress({ step: "uploadBundle", status: "success" });

    await throwIfCanceled();

    // Step 6: Update content metadata
    // For redeploys, the update step opens the "Create Deployment Record"
    // stage in the logs tree.
    lastStep = "updateContent";
    onProgress({
      step: "updateContent",
      status: "start",
      data: { contentId: contentId!, saveName },
    });
    onProgress({
      step: "updateContent",
      status: "log",
      message: "Updating deployment settings",
    });
    await api.updateDeployment(
      ContentID(contentId),
      connectContentFromConfig(config),
      signal,
    );
    onProgress({
      step: "updateContent",
      status: "log",
      message: "Done updating settings",
    });
    onProgress({ step: "updateContent", status: "success" });

    await throwIfCanceled();

    // Step 7: Set environment variables (if any)
    const envVars = mergeEnvVars(config.environment, secrets);
    if (envVars) {
      lastStep = "setEnvVars";
      onProgress({ step: "setEnvVars", status: "start" });
      onProgress({
        step: "setEnvVars",
        status: "log",
        message: "Setting environment variables",
      });
      for (const name of Object.keys(envVars)) {
        const isSecret = secrets !== undefined && name in secrets;
        onProgress({
          step: "setEnvVars",
          status: "log",
          message: isSecret
            ? "Setting secret as environment variable"
            : "Setting environment variable",
          data: { name },
        });
      }
      await api.setEnvVars(ContentID(contentId), envVars, signal);
      onProgress({
        step: "setEnvVars",
        status: "log",
        message: "Done setting environment variables",
      });
      onProgress({ step: "setEnvVars", status: "success" });
    }

    await throwIfCanceled();

    // Step 8: Deploy the bundle
    lastStep = "deployBundle";
    onProgress({ step: "deployBundle", status: "start" });
    onProgress({
      step: "deployBundle",
      status: "log",
      message: "Activating Deployment",
    });
    const { data: deployOutput } = await api.deployBundle(
      ContentID(contentId),
      bundleId,
      signal,
    );
    onProgress({
      step: "deployBundle",
      status: "log",
      message: "Activation requested",
    });
    onProgress({
      step: "deployBundle",
      status: "success",
      data: { taskId: deployOutput.task_id },
    });

    await throwIfCanceled();

    // Step 9: Wait for server-side task to complete
    lastStep = "waitForTask";
    onProgress({ step: "waitForTask", status: "start" });
    await api.waitForTask(
      TaskID(deployOutput.task_id),
      undefined,
      (lines) => {
        for (const line of lines) {
          if (line) {
            onProgress({ step: "waitForTask", status: "log", message: line });
          }
        }
      },
      signal,
    );
    onProgress({ step: "waitForTask", status: "success" });

    await throwIfCanceled();

    // Step 10: Validate deployment (optional)
    if (config.validate) {
      lastStep = "validateDeployment";
      onProgress({
        step: "validateDeployment",
        status: "start",
        data: { url: getDirectUrl(serverUrl, contentId) },
      });
      // Log events are emitted before the HTTP call so the logger writes
      // "Testing URL…" before the request is made.
      onProgress({
        step: "validateDeployment",
        status: "log",
        message: "Validating Deployment",
      });
      // Message is just "Testing URL"; displayEventStreamMessage appends
      // data.url to produce "Testing URL /content/{id}/".
      onProgress({
        step: "validateDeployment",
        status: "log",
        message: "Testing URL",
        data: { url: `/content/${contentId}/` },
      });
      await api.validateDeployment(ContentID(contentId), signal);
      onProgress({
        step: "validateDeployment",
        status: "log",
        message: "Done validating deployment",
      });
      onProgress({ step: "validateDeployment", status: "success" });
    }

    // Write completed record (deployedAt is set by writePublishRecord)
    await writePublishRecord(deploymentPath, record);

    return {
      contentId,
      dashboardUrl: record.dashboardUrl!,
      directUrl: record.directUrl!,
      logsUrl: record.logsUrl!,
      bundleId: bundleDTO.id,
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
    const classified = classifyDeploymentError(lastStep, err);

    // Emit failure event so progress consumers know which step failed.
    // Use the classified message (user-friendly) rather than the raw error.
    if (lastStep) {
      const failData: Record<string, string> = {};
      // Include URLs when we have a content ID so the UI can link to logs
      if (record.logsUrl) {
        failData.logsUrl = record.logsUrl;
      }
      if (record.dashboardUrl) {
        failData.dashboardUrl = record.dashboardUrl;
      }
      // Include HTTP status for validateDeployment failures
      if (
        lastStep === "validateDeployment" &&
        isAxiosError(err) &&
        err.response
      ) {
        failData.status = String(err.response.status);
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
 */
function classifyDeploymentError(
  lastStep: PublishStep | undefined,
  err: unknown,
): { code: ErrorCode; message: string } {
  const fallbackMessage = err instanceof Error ? err.message : String(err);

  // Certificate verification errors (any step)
  // Must be checked before the generic network error check below, because
  // TLS failures also have no `response`.
  if (isAxiosError(err) && isCertificateError(err)) {
    return {
      code: "errorCertificateVerification",
      message:
        "Certificate verification failed. " +
        "Check the server's TLS certificate or disable verification.",
    };
  }

  // Network errors (no response received) — server unreachable due to
  // DNS failure, VPN disconnected, firewall, etc.
  if (isAxiosError(err) && !err.response) {
    return {
      code: "connectionFailed",
      message:
        "Unable to reach the server. " +
        "Check your network connection, VPN, and server URL.",
    };
  }

  // Authentication failures (401 from any step, but typically preflight)
  if (isAxiosError(err) && err.response?.status === 401) {
    return {
      code: "authFailedErr",
      message: "Authentication failed. Check your credentials.",
    };
  }

  // 404 during updateContent — content was deleted server-side
  if (
    lastStep === "updateContent" &&
    isAxiosError(err) &&
    err.response?.status === 404
  ) {
    return {
      code: "deploymentNotFoundErr",
      message:
        "Deployment target not found. " +
        "The content may have been deleted on the server.",
    };
  }

  // Validation failures (5xx from content URL)
  if (
    lastStep === "validateDeployment" &&
    isAxiosError(err) &&
    err.response &&
    err.response.status >= 500
  ) {
    return {
      code: "deployedContentNotRunning",
      message:
        "Deployed content does not appear to be running. " +
        "Check the deployment logs for more information.",
    };
  }

  // Server-side task failure (waitForTask throws plain Error, not AxiosError)
  if (
    lastStep === "waitForTask" &&
    err instanceof Error &&
    !isAxiosError(err)
  ) {
    return {
      code: "deployFailed",
      message: err.message,
    };
  }

  // App mode mismatch (thrown by our own preflight check)
  if (
    lastStep === "preflight" &&
    err instanceof Error &&
    err.message.includes("previously deployed as")
  ) {
    return {
      code: "appModeNotModifiableErr",
      message: err.message,
    };
  }

  // Requirements file missing (thrown by our preflight check).
  if (
    lastStep === "preflight" &&
    err instanceof Error &&
    err.message.includes("Missing dependency file")
  ) {
    return {
      code: "requirementsFileReadingError",
      message: err.message,
    };
  }

  // Other HTTP errors — include the full response body.
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

/** Detect TLS/certificate errors from axios error codes. */
function isCertificateError(err: { code?: string }): boolean {
  const certCodes = [
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "CERT_HAS_EXPIRED",
  ];
  return !!err.code && certCodes.includes(err.code);
}

// ---------------------------------------------------------------------------
// Server settings validation
// ---------------------------------------------------------------------------

/** API content types that require the "allow-apis" license. */
function isAPIContentType(contentType: string): boolean {
  return (
    contentType === ContentType.PYTHON_FLASK ||
    contentType === ContentType.PYTHON_FASTAPI ||
    contentType === ContentType.R_PLUMBER
  );
}

/** App content types that support run_as_current_user. */
function isAppContentType(contentType: string): boolean {
  return (
    contentType === ContentType.PYTHON_SHINY ||
    contentType === ContentType.R_SHINY ||
    contentType === ContentType.PYTHON_BOKEH ||
    contentType === ContentType.PYTHON_DASH ||
    contentType === ContentType.PYTHON_GRADIO ||
    contentType === ContentType.PYTHON_PANEL ||
    contentType === ContentType.PYTHON_STREAMLIT
  );
}

/**
 * Validate deployment configuration against server settings.
 */
function checkServerSettings(
  settings: AllSettings,
  config: ConfigurationDetails,
): void {
  // API licensing check
  if (
    isAPIContentType(config.type) &&
    !settings.general.license["allow-apis"]
  ) {
    throw new Error("API deployment is not licensed on this Connect server");
  }

  if (config.connect) {
    checkAccess(settings, config);
    checkRuntime(settings, config);
    checkKubernetes(settings, config);
  }
}

function checkAccess(
  settings: AllSettings,
  config: ConfigurationDetails,
): void {
  const access = config.connect?.access;
  if (!access) {
    return;
  }

  if (access.runAsCurrentUser) {
    if (!settings.general.license["current-user-execution"]) {
      throw new Error(
        "run_as_current_user is not licensed on this Connect server",
      );
    }
    if (!settings.application.run_as_current_user) {
      throw new Error(
        "run_as_current_user is not configured on this Connect server",
      );
    }
    if (settings.user.user_role !== "administrator") {
      throw new Error("run_as_current_user requires administrator privileges");
    }
    if (!isAppContentType(config.type)) {
      throw new Error(
        "run_as_current_user can only be used with application types, not APIs or reports",
      );
    }
  }

  if (access.runAs && settings.user.user_role !== "administrator") {
    throw new Error("run_as requires administrator privileges");
  }
}

function checkRuntime(
  settings: AllSettings,
  config: ConfigurationDetails,
): void {
  const runtime = config.connect?.runtime;
  if (!runtime) {
    return;
  }

  // Static content (HTML → "static" app mode) cannot have runtime settings.
  const appMode = appModeFromType(config.type);
  if (appMode === "static") {
    throw new Error("Runtime settings cannot be applied to static content");
  }

  const s = settings.scheduler;

  checkMaxLimit("max_processes", runtime.maxProcesses, s.max_processes_limit);
  checkMaxLimit("min_processes", runtime.minProcesses, s.min_processes_limit);

  // min_processes cannot exceed max_processes
  checkMinMax(
    "min_processes",
    runtime.minProcesses,
    s.min_processes,
    "max_processes",
    runtime.maxProcesses,
    s.max_processes,
  );
}

function checkKubernetes(
  settings: AllSettings,
  config: ConfigurationDetails,
): void {
  const k = config.connect?.kubernetes;
  if (!k) {
    return;
  }

  if (!settings.general.license["enable-launcher"]) {
    throw new Error(
      "Off-host execution with Kubernetes is not licensed on this Connect server",
    );
  }
  if (settings.general.execution_type !== "Kubernetes") {
    throw new Error(
      "Off-host execution with Kubernetes is not configured on this Connect server",
    );
  }
  if (k.defaultImageName && !settings.general.default_image_selection_enabled) {
    throw new Error(
      "Default image selection is not enabled on this Connect server",
    );
  }
  if (k.serviceAccountName && settings.user.user_role !== "administrator") {
    throw new Error("service_account_name requires administrator privileges");
  }

  const s = settings.scheduler;

  checkMaxLimit("cpu_request", k.cpuRequest, s.max_cpu_request);
  checkMaxLimit("cpu_limit", k.cpuLimit, s.max_cpu_limit);
  checkMaxLimit("memory_request", k.memoryRequest, s.max_memory_request);
  checkMaxLimit("memory_limit", k.memoryLimit, s.max_memory_limit);
  checkMaxLimit("amd_gpu_limit", k.amdGpuLimit, s.max_amd_gpu_limit);
  checkMaxLimit("nvidia_gpu_limit", k.nvidiaGpuLimit, s.max_nvidia_gpu_limit);

  // Requests cannot exceed limits
  checkMinMax(
    "cpu_request",
    k.cpuRequest,
    s.cpu_request,
    "cpu_limit",
    k.cpuLimit,
    s.cpu_limit,
  );
  checkMinMax(
    "memory_request",
    k.memoryRequest,
    s.memory_request,
    "memory_limit",
    k.memoryLimit,
    s.memory_limit,
  );
}

/**
 * Check that a configured value does not exceed the server's maximum.
 * Skips check if value is undefined or limit is 0.
 */
function checkMaxLimit(
  attr: string,
  value: number | undefined,
  limit: number,
): void {
  if (value === undefined) {
    return;
  }
  if (value < 0) {
    throw new Error(`${attr} value cannot be less than 0`);
  }
  if (limit === 0) {
    return;
  }
  if (value > limit) {
    throw new Error(
      `${attr} value of ${value} is higher than configured maximum of ${limit} on this server`,
    );
  }
}

/**
 * Check that a min value does not exceed a max value, using server defaults
 * when the config doesn't specify a value.
 */
function checkMinMax(
  minAttr: string,
  cfgMin: number | undefined,
  defaultMin: number,
  maxAttr: string,
  cfgMax: number | undefined,
  defaultMax: number,
): void {
  const minValue = cfgMin ?? defaultMin;
  const maxValue = cfgMax ?? defaultMax;
  if (maxValue === 0) {
    return;
  }
  if (minValue > maxValue) {
    throw new Error(
      `${minAttr} value of ${minValue} is higher than ${maxAttr} value of ${maxValue}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBundleUrl(
  serverUrl: string,
  contentId: string,
  bundleId: string,
): string {
  return `${serverUrl}/__api__/v1/content/${contentId}/bundles/${bundleId}/download`;
}
