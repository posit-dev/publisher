// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import { stringify as stringifyTOML } from "smol-toml";
import { isAxiosError } from "axios";

import {
  ConnectAPI,
  ContentID,
  BundleID,
  TaskID,
} from "@posit-dev/connect-api";

import type { ConfigurationDetails } from "../api/types/configurations";
import type { ServerType } from "../api/types/contentRecords";
import type { PositronRSettings } from "../api/types/positron";

import { manifestFromConfig } from "../bundler/manifestFromConfig";
import { appModeFromType, contentTypeFromAppMode } from "../bundler/appMode";
import { connectContentFromConfig } from "../bundler/connectContentFromConfig";
import { createBundle } from "../bundler/bundler";
import { getFilenames } from "../bundler/manifest";
import type { Manifest } from "../bundler/types";

import { resolveRPackages, readPythonRequirements } from "./dependencies";
import {
  findExtraDependencies,
  recordExtraDependencies,
  cleanupExtraDependencies,
} from "./extraDependencies";
import { scanRPackages } from "../interpreters/rPackages";
import type { RenvLockfile } from "./rPackageDescriptions";

import { forceProductTypeCompliance } from "../toml/configCompliance";
import { convertKeysToSnakeCase } from "../toml/convertKeys";
import { stripEmpty, isRecord, expandInlineArrays } from "../toml/tomlHelpers";
import { getDashboardUrl, getDirectUrl, getLogsUrl } from "../toml/urlHelpers";
import { fileExistsAt } from "../interpreters/fsUtils";
import { logger } from "../logging";
import type { ErrorCode } from "../utils/errorTypes";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PublishStep =
  | "createManifest"
  | "preflight"
  | "createNewDeployment"
  | "createDeployment"
  | "createBundle"
  | "uploadBundle"
  | "updateContent"
  | "setEnvVars"
  | "deployBundle"
  | "waitForTask"
  | "validateDeployment";

export type PublishEvent = {
  step: PublishStep;
  status: "start" | "success" | "failure" | "log";
  message?: string;
  /** Typed error code for failure events. */
  errCode?: ErrorCode;
  /** Additional data for event stream injection (e.g., URLs, status codes). */
  data?: Record<string, string>;
};

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
};

export type PublishResult = {
  contentId: string;
  dashboardUrl: string;
  directUrl: string;
  logsUrl: string;
  bundleId: string;
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function connectPublish(
  options: ConnectPublishOptions,
): Promise<PublishResult> {
  const {
    api,
    projectDir,
    saveName,
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
  } = options;

  // Work on a copy so we don't mutate the caller's config
  const config = structuredClone(options.config);
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
    setRecordContentInfo(record, serverUrl, contentId);
  }

  // Write initial deployment record
  await writePublishRecord(deploymentPath, record);

  let lastStep: PublishStep | undefined;

  try {
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
    const { user } = await api.testAuthentication();
    onProgress({
      step: "preflight",
      status: "log",
      message: "Publishing with credentials",
      data: { username: user.username, email: user.email },
    });

    // Validate configuration against known constraints (mirrors Go's checkConfig/checkRequirementsFile)
    if (config.description && config.description.length > 4096) {
      throw new Error("The description cannot be longer than 4096 characters.");
    }

    if (config.python) {
      const packageFile = config.python.packageFile || "requirements.txt";
      const packageFilePath = path.join(projectDir, packageFile);
      const packageFileExists = await fileExistsAt(packageFilePath);

      // Check that the file exists on disk
      if (!packageFileExists) {
        throw new Error(
          `Missing dependency file ${packageFile}. ` +
            `This file must be included in the deployment.`,
        );
      }

      // Check that the file is included in the configured file patterns
      const filePatterns = config.files ?? [];
      if (filePatterns.length > 0) {
        const isIncluded = filePatterns.some((pattern) =>
          pattern.endsWith(packageFile),
        );
        if (!isIncluded) {
          throw new Error(
            `Missing dependency file ${packageFile}. ` +
              `This file must be included in the deployment.`,
          );
        }
      }
    }

    // Verify existing content when redeploying (mirrors Go's ValidateDeploymentTarget)
    if (contentId) {
      onProgress({
        step: "preflight",
        status: "log",
        message: "Verifying existing content",
        data: { content_id: contentId },
      });

      let existing;
      try {
        const resp = await api.contentDetails(ContentID(contentId));
        existing = resp.data;
      } catch (err) {
        logger.debug(`contentDetails failed for ${contentId}:`, err);
        throw new Error(
          `Deployment target cannot be reached. Halting deployment. ` +
            `(Content ID = ${contentId})`,
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
      const { data: created } = await api.createDeployment({ name: "" });
      contentId = created.guid;
      setRecordContentInfo(record, serverUrl, contentId);
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

    // Step 4: Create bundle archive
    lastStep = "createBundle";
    onProgress({ step: "createBundle", status: "start" });
    onProgress({
      step: "createBundle",
      status: "log",
      message: "Preparing files",
    });
    const { bundle, manifest: finalManifest } = await buildBundleArchive(
      projectDir,
      config,
      manifest,
      lockfilePath,
    );
    record.files = getFilenames(finalManifest);

    // Record dependencies in the deployment record
    const pythonReqs = await readPythonRequirements(projectDir, config.python);
    if (pythonReqs) {
      record.requirements = pythonReqs;
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

    // Step 6: Update content metadata
    // For redeploys, the update step opens the "Create Deployment Record"
    // stage in the logs tree (matching Go's publish/createDeployment events).
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
    );
    onProgress({
      step: "updateContent",
      status: "log",
      message: "Done updating settings",
    });
    onProgress({ step: "updateContent", status: "success" });

    // Step 7: Set environment variables (if any)
    const envVars = mergeEnvVars(config.environment, secrets);
    if (envVars) {
      lastStep = "setEnvVars";
      onProgress({ step: "setEnvVars", status: "start" });
      // Log each variable individually (matching Go's per-variable messages)
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
      await api.setEnvVars(ContentID(contentId), envVars);
      onProgress({
        step: "setEnvVars",
        status: "log",
        message: "Done setting environment variables",
      });
      onProgress({ step: "setEnvVars", status: "success" });
    }

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

    // Step 9: Wait for server-side task to complete
    lastStep = "waitForTask";
    onProgress({ step: "waitForTask", status: "start" });
    await api.waitForTask(TaskID(deployOutput.task_id), undefined, (lines) => {
      for (const line of lines) {
        if (line) {
          onProgress({ step: "waitForTask", status: "log", message: line });
        }
      }
    });
    onProgress({ step: "waitForTask", status: "success" });

    // Step 10: Validate deployment (optional)
    if (config.validate) {
      lastStep = "validateDeployment";
      onProgress({
        step: "validateDeployment",
        status: "start",
        data: { url: getDirectUrl(serverUrl, contentId) },
      });
      // Log events are emitted before the HTTP call to match the Go
      // backend's ordering, where the logger writes "Testing URL…"
      // before the request is made.
      onProgress({
        step: "validateDeployment",
        status: "log",
        message: "Validating Deployment",
      });
      onProgress({
        step: "validateDeployment",
        status: "log",
        message: `Testing URL /content/${contentId}/`,
        data: { url: `/content/${contentId}/` },
      });
      await api.validateDeployment(ContentID(contentId));
      onProgress({
        step: "validateDeployment",
        status: "log",
        message: "Done validating deployment",
      });
      onProgress({ step: "validateDeployment", status: "success" });
    }

    // Write completed record
    record.deployedAt = new Date().toISOString();
    await writePublishRecord(deploymentPath, record);

    return {
      contentId,
      dashboardUrl: record.dashboardUrl!,
      directUrl: record.directUrl!,
      logsUrl: record.logsUrl!,
      bundleId: bundleDTO.id,
    };
  } catch (err) {
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
 * Mirrors the Go backend's error classification so the UI can show
 * targeted error messages and troubleshooting guidance.
 */
function classifyDeploymentError(
  lastStep: PublishStep | undefined,
  err: unknown,
): { code: ErrorCode; message: string } {
  const fallbackMessage = err instanceof Error ? err.message : String(err);

  // Certificate verification errors (any step)
  if (isAxiosError(err) && isCertificateError(err)) {
    return {
      code: "errorCertificateVerification",
      message:
        "Certificate verification failed. " +
        "Check the server's TLS certificate or disable verification.",
    };
  }

  // Authentication failures (401 from any step, but typically preflight)
  if (isAxiosError(err) && err.response?.status === 401) {
    return {
      code: "authenticationFailed",
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
      code: "deploymentNotFound",
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
      code: "appModeNotModifiable",
      message: err.message,
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
// Manifest building (R scan-if-missing logic)
// ---------------------------------------------------------------------------

type ManifestResult = {
  manifest: Manifest;
  /** Absolute path to the lockfile used for R packages, if any. */
  lockfilePath: string | undefined;
  /** Parsed lockfile content (PascalCase, as read from renv.lock). */
  lockfile: RenvLockfile | undefined;
};

async function buildManifest(
  projectDir: string,
  config: ConfigurationDetails,
  rPath: string | undefined,
  positronR: PositronRSettings | undefined,
): Promise<ManifestResult> {
  const manifest = manifestFromConfig(config);
  let lockfilePath: string | undefined;
  let lockfile: RenvLockfile | undefined;

  if (config.r) {
    const packageFile = config.r.packageFile || "renv.lock";
    const lockfileOnDisk = path.join(projectDir, packageFile);
    const lockExists = await fileExistsAt(lockfileOnDisk);

    if (lockExists) {
      // Use the existing lockfile directly
      const resolved = await resolveRPackages(projectDir, config.r);
      if (resolved) {
        manifest.packages = resolved.packages;
        lockfilePath = resolved.lockfilePath;
        lockfile = resolved.lockfile;
      }
    } else {
      // No lockfile — scan project for R dependencies
      if (!rPath) {
        throw new Error(
          "R interpreter is required to scan for R package dependencies, " +
            "but none was found. Install R or provide an renv.lock file.",
        );
      }

      // Inject implicit deps (e.g. shiny, rmarkdown) so renv can discover them
      const extraDeps = await findExtraDependencies(
        config.type,
        config.hasParameters,
        projectDir,
      );
      const depsFile = await recordExtraDependencies(projectDir, extraDeps);

      try {
        await scanRPackages(projectDir, rPath, packageFile, positronR);
      } finally {
        if (depsFile) {
          await cleanupExtraDependencies(depsFile);
        }
      }

      // Now resolve from the generated lockfile
      const resolved = await resolveRPackages(projectDir, config.r);
      if (resolved) {
        manifest.packages = resolved.packages;
        lockfilePath = resolved.lockfilePath;
        lockfile = resolved.lockfile;
      }
    }
  }

  return { manifest, lockfilePath, lockfile };
}

// ---------------------------------------------------------------------------
// Bundle creation with lockfile staging
// ---------------------------------------------------------------------------

async function buildBundleArchive(
  projectDir: string,
  config: ConfigurationDetails,
  manifest: Manifest,
  lockfilePath: string | undefined,
): Promise<{ bundle: Buffer; manifest: Manifest }> {
  const basePatterns = config.files?.length ? [...config.files] : ["*"];
  const extraPatterns: string[] = [];
  let stagedLockfile: string | undefined;

  // If the lockfile is not at the project root as renv.lock, stage a copy
  // under .posit/publish/deployments/ and adjust patterns so the bundle
  // includes the staged copy instead of any root renv.lock.
  if (lockfilePath) {
    const rootLockfile = path.join(projectDir, "renv.lock");
    if (path.resolve(lockfilePath) !== path.resolve(rootLockfile)) {
      stagedLockfile = await copyLockfileToPositDir(projectDir, lockfilePath);
      extraPatterns.push("!renv.lock", ".posit/publish/deployments/renv.lock");
    }
  }

  const filePatterns = [...basePatterns, ...extraPatterns];

  try {
    const result = await createBundle({
      projectPath: projectDir,
      manifest,
      filePatterns,
    });

    return { bundle: result.bundle, manifest: result.manifest };
  } finally {
    if (stagedLockfile) {
      await fs.unlink(stagedLockfile).catch(() => {});
    }
  }
}

async function copyLockfileToPositDir(
  projectDir: string,
  lockfilePath: string,
): Promise<string> {
  const targetDir = path.join(projectDir, ".posit", "publish", "deployments");
  await fs.mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, "renv.lock");
  await fs.copyFile(lockfilePath, target);
  return target;
}

// ---------------------------------------------------------------------------
// Deployment record writing
// ---------------------------------------------------------------------------

const DEPLOYMENT_SCHEMA_URL =
  "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json";

const AUTOGEN_HEADER =
  "# This file is automatically generated by Posit Publisher; do not edit.\n";

// Exported for testing — allows round-trip validation through loadDeploymentFromFile.
export type PublishRecord = {
  schema: string;
  serverType: ServerType | string;
  serverUrl: string;
  clientVersion: string;
  createdAt: string;
  type: string;
  configName: string;
  config?: ConfigurationDetails;
  id?: string;
  dashboardUrl?: string;
  directUrl?: string;
  logsUrl?: string;
  bundleId?: string;
  bundleUrl?: string;
  files?: string[];
  requirements?: string[];
  renv?: Record<string, unknown>;
  deployedAt?: string;
  deploymentError?: { code: string; message: string; operation: string };
};

function setRecordContentInfo(
  record: PublishRecord,
  serverUrl: string,
  contentId: string,
): void {
  record.id = contentId;
  record.dashboardUrl = getDashboardUrl(serverUrl, contentId);
  record.directUrl = getDirectUrl(serverUrl, contentId);
  record.logsUrl = getLogsUrl(serverUrl, contentId);
}

/**
 * Build a TOML-ready object from the publish record.
 *
 * Top-level keys use snake_case to match the deployment record schema.
 * The renv section uses lowercase keys (r, packages, version, etc.)
 * as defined by the schema, not the PascalCase from renv.lock files.
 */
function recordToTomlObject(record: PublishRecord): Record<string, unknown> {
  // Build the configuration section separately — it needs key conversion
  // and empty-value stripping that the other fields don't.
  let configuration: unknown;
  if (record.config) {
    // Clone and remove non-TOML fields, matching Go's toml:"-" tags
    // and the behavior of configWriter/deploymentWriter.
    const cfg = { ...record.config };
    delete cfg.comments;
    delete cfg.alternatives;
    delete cfg.entrypointObjectRef;

    const snakeConfig = convertKeysToSnakeCase(cfg);
    if (isRecord(snakeConfig)) {
      stripEmpty(snakeConfig);
    }
    configuration = snakeConfig;
  }

  // Keys are mapped explicitly because some don't follow simple
  // camelCase→snake_case (e.g. configName → configuration_name,
  // schema → $schema). Undefined values are dropped by smol-toml's
  // stringify, so `|| undefined` omits unset optional fields.
  return {
    $schema: record.schema,
    server_type: record.serverType,
    server_url: record.serverUrl,
    client_version: record.clientVersion,
    created_at: record.createdAt,
    type: record.type,
    configuration_name: record.configName,
    configuration,
    id: record.id || undefined,
    dashboard_url: record.dashboardUrl || undefined,
    direct_url: record.directUrl || undefined,
    logs_url: record.logsUrl || undefined,
    bundle_id: record.bundleId || undefined,
    bundle_url: record.bundleUrl || undefined,
    files: record.files || undefined,
    requirements: record.requirements || undefined,
    renv: record.renv || undefined,
    deployed_at: record.deployedAt || undefined,
    deployment_error: record.deploymentError || undefined,
  };
}

// Exported for testing — allows round-trip validation through loadDeploymentFromFile.
export async function writePublishRecord(
  deploymentPath: string,
  record: PublishRecord,
): Promise<void> {
  const obj = recordToTomlObject(record);
  const content =
    AUTOGEN_HEADER + expandInlineArrays(stringifyTOML(obj)) + "\n";
  await fs.mkdir(path.dirname(deploymentPath), { recursive: true });
  await fs.writeFile(deploymentPath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeEnvVars(
  configEnv: Record<string, string> | undefined,
  secrets: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!configEnv && !secrets) {
    return undefined;
  }
  const merged: Record<string, string> = {};
  if (configEnv) {
    Object.assign(merged, configEnv);
  }
  if (secrets) {
    Object.assign(merged, secrets);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Convert a PascalCase renv.lock structure to the lowercase shape
 * expected by the deployment record schema.
 *
 * renv.lock uses PascalCase (R, Packages, Version, etc.) but the
 * deployment record schema expects lowercase (r, packages, version).
 * Go handles this via struct tags; we convert explicitly.
 */
export function lockfileToDeploymentRenv(
  lockfile: RenvLockfile,
): Record<string, unknown> {
  const renv: Record<string, unknown> = {};

  if (lockfile.R) {
    renv.r = {
      version: lockfile.R.Version,
      ...(lockfile.R.Repositories && {
        repositories: lockfile.R.Repositories.map((repo) => ({
          name: repo.Name,
          url: repo.URL,
        })),
      }),
    };
  }

  if (lockfile.Packages) {
    const packages: Record<string, Record<string, unknown>> = {};
    for (const [name, pkg] of Object.entries(lockfile.Packages)) {
      const converted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(pkg)) {
        if (value !== undefined && value !== null && value !== "") {
          converted[pascalToSnake(key)] = value;
        }
      }
      packages[name] = converted;
    }
    renv.packages = packages;
  }

  return renv;
}

/**
 * Convert a PascalCase or camelCase key to snake_case.
 * Handles sequences of capitals: "RemotePkgRef" → "remote_pkg_ref",
 * "URL" → "url", "Package" → "package".
 */
function pascalToSnake(key: string): string {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function getBundleUrl(
  serverUrl: string,
  contentId: string,
  bundleId: string,
): string {
  return `${serverUrl}/__api__/v1/content/${contentId}/bundles/${bundleId}/download`;
}
