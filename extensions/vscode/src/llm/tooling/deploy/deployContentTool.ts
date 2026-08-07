// Copyright (C) 2026 by Posit Software, PBC.

import {
  CancellationToken,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolResult,
  LanguageModelTextPart,
} from "vscode";
import * as workspaces from "src/workspaces";
import { inspectProject } from "src/inspect";
import {
  writeConfigToFile,
  createDeploymentRecord,
  loadAllConfigurations,
  loadAllDeployments,
  loadConfiguration,
} from "src/toml";
import { relativeProjectDir } from "src/toml/tomlHelpers";
import { isConfigurationError, isContentRecordError } from "src/api";
import {
  Configuration,
  ConfigurationError,
  ContentType,
} from "src/api/types/configurations";
import {
  AllContentRecordTypes,
  ContentRecordError,
  ServerType,
} from "src/api/types/contentRecords";
import { newConfigFileNameFromTitle, newDeploymentName } from "src/utils/names";
import { getProductName, getProductType } from "src/utils/multiStepHelpers";
import { describeError } from "src/utils/errors";
import { extensionSettings } from "src/extension";
import type { LLMToolingHomeView, LLMToolingState } from "src/llm/types";

export interface DeployContentInput {
  directory: string;
  entrypoint: string;
  credentialName: string;
  title?: string;
  contentType?: string;
  deploymentName?: string;
  configurationName?: string;
}

export type DeployToolResult =
  | {
      status: "needs-credential";
      message: string;
      availableCredentials: string[];
    }
  | { status: "needs-content-type"; message: string; candidates: string[] }
  | {
      status: "success";
      deploymentName: string;
      configurationName: string;
      contentId: string;
      dashboardUrl: string;
      directUrl: string;
      logsUrl: string;
    }
  | { status: "failed"; error: string };

function isValidContentType(value: string): value is ContentType {
  const all: string[] = Object.values(ContentType);
  return all.includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDeployContentInput(
  input: Partial<DeployContentInput>,
): input is DeployContentInput {
  return (
    isNonEmptyString(input.directory) &&
    isNonEmptyString(input.entrypoint) &&
    isNonEmptyString(input.credentialName)
  );
}

/**
 * Deploy a project to Posit Connect or Connect Cloud. Creates a configuration
 * and deployment record if none are supplied, then runs the headless deploy and
 * returns a structured result. Never accepts secrets — the target is named by
 * an existing stored credential.
 */
export class DeployContentTool implements LanguageModelTool<DeployContentInput> {
  constructor(
    private readonly state: LLMToolingState,
    private readonly homeViewProvider: LLMToolingHomeView,
    private readonly clientVersion: string,
  ) {}

  async invoke(
    options: LanguageModelToolInvocationOptions<DeployContentInput>,
    token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const result = await this.run(options.input ?? {}, token);
    return new LanguageModelToolResult([
      new LanguageModelTextPart(JSON.stringify(result, null, 2)),
    ]);
  }

  /**
   * Core logic shared by the `vscode.lm` tool and the Positron agent command.
   * Returns the structured result object (never wrapped) so both call paths
   * reuse the same implementation. `token` is only available on the
   * `vscode.lm` path — the Positron agent command path has no equivalent, so
   * canceling the deploy there relies on the progress notification's own
   * cancel button.
   */
  async run(
    input: Partial<DeployContentInput> = {},
    token?: CancellationToken,
  ): Promise<DeployToolResult> {
    try {
      if (!isDeployContentInput(input)) {
        const missingFields: string[] = [];
        if (!isNonEmptyString(input.directory)) {
          missingFields.push("directory");
        }
        if (!isNonEmptyString(input.entrypoint)) {
          missingFields.push("entrypoint");
        }
        if (!isNonEmptyString(input.credentialName)) {
          missingFields.push("credentialName");
        }
        return {
          status: "failed",
          error: `Missing required deployment input: ${missingFields.join(", ")}.`,
        };
      }

      const { directory, entrypoint, credentialName } = input;
      const root = workspaces.path();
      if (!root) {
        return {
          status: "failed",
          error: "No workspace folder is open.",
        };
      }

      const resolvedDir = workspaces.resolveWithinWorkspace(root, directory);
      if (!resolvedDir.ok) {
        return {
          status: "failed",
          error: resolvedDir.error,
        };
      }

      // Use the canonical project directory for every lookup and write. This
      // keeps paths such as "./app" and "app" from referring to different
      // in-memory content records.
      const absDir = resolvedDir.absPath;
      const relDir = relativeProjectDir(absDir, root);

      const credential = this.state.findCredential(credentialName);
      if (!credential) {
        const all = await this.state.credentialsService.list();
        return {
          status: "needs-credential",
          message: `No stored credential named "${credentialName}". Call addCredential (with target/serverUrl if known from context) and wait for its result — if it reports "added", call deployContent again with the same arguments to continue automatically. If it reports "canceled", ask the user how they'd like to proceed, or offer to pick from the available list.`,
          availableCredentials: all.map((c) => c.name),
        };
      }

      if (
        credential.serverType === ServerType.CONNECT_CLOUD &&
        !extensionSettings.enableConnectCloud()
      ) {
        return {
          status: "failed",
          error: `Credential "${credential.name}" targets Connect Cloud, which is disabled (positPublisher.enableConnectCloud). Ask the user to re-enable it, or deploy with a Connect credential instead.`,
        };
      }

      const expectedProductType = getProductType(credential.serverType);

      // Resolve the configuration: reuse an existing one, or create a new one.
      let configName = input.configurationName;
      if (configName) {
        const existingConfig = await loadConfiguration(
          configName,
          relDir,
          root,
        );
        if (existingConfig.configuration.productType !== expectedProductType) {
          return {
            status: "failed",
            error: `Configuration "${configName}" targets ${getProductName(existingConfig.configuration.productType) ?? "an unrecognized product"}, but credential "${credential.name}" targets ${getProductName(expectedProductType)}. Pick a matching configuration, or omit configurationName to create a new one.`,
          };
        }
      }
      if (!configName) {
        const inspections = await inspectProject({
          projectDir: absDir,
          entrypoint,
          relativeDir: relDir,
        });
        const match = inspections.find(
          (i) => i.configuration.entrypoint === entrypoint,
        );
        if (!match) {
          const candidates = inspections
            .map((i) => i.configuration.entrypoint)
            .filter(isNonEmptyString);
          const candidateMessage =
            candidates.length > 0
              ? ` Available entrypoints: ${candidates.join(", ")}.`
              : "";
          return {
            status: "failed",
            error: `Entrypoint "${entrypoint}" was not found in the project.${candidateMessage}`,
          };
        }

        const detectedType = match.configuration.type;
        const chosenType = input.contentType ?? detectedType;
        if (chosenType === ContentType.UNKNOWN) {
          return {
            status: "needs-content-type",
            message:
              "Could not determine the content type. Provide contentType explicitly.",
            candidates: Object.values(ContentType).filter(
              (t) => t !== ContentType.UNKNOWN,
            ),
          };
        }
        if (!isValidContentType(chosenType)) {
          return {
            status: "failed",
            error: `Invalid contentType "${chosenType}".`,
          };
        }

        const configDetails = {
          ...match.configuration,
          type: chosenType,
          title: input.title ?? match.configuration.title,
          productType: expectedProductType,
        };

        const existingConfigs = await loadAllConfigurations(relDir, root);
        const existingConfigNames = existingConfigs
          .filter(
            (c: Configuration | ConfigurationError): c is Configuration => {
              return !isConfigurationError(c);
            },
          )
          .map((c) => c.configurationName);
        configName = newConfigFileNameFromTitle(
          configDetails.title || entrypoint,
          existingConfigNames,
        );
        await writeConfigToFile(configName, relDir, root, configDetails);
      }

      // Resolve the deployment record: reuse or create.
      let deploymentName = input.deploymentName;
      if (!deploymentName) {
        const existingDeployments = await loadAllDeployments(relDir, root);
        const existingNames = existingDeployments
          .filter(
            (
              d: AllContentRecordTypes,
            ): d is Exclude<AllContentRecordTypes, ContentRecordError> => {
              return !isContentRecordError(d);
            },
          )
          .map((d) => d.deploymentName);
        deploymentName = newDeploymentName(existingNames);
        await createDeploymentRecord({
          saveName: deploymentName,
          projectDir: relDir,
          rootDir: root,
          serverUrl: credential.url,
          serverType: credential.serverType,
          configName,
          cloudAccountName:
            credential.serverType === ServerType.CONNECT_CLOUD
              ? credential.accountName
              : undefined,
          clientVersion: this.clientVersion,
        });
      }

      const outcome = await this.homeViewProvider.deployProject(
        deploymentName,
        credentialName,
        configName,
        relDir,
        token,
      );

      if (outcome.status === "success") {
        return {
          status: "success",
          deploymentName,
          configurationName: configName,
          contentId: outcome.result.contentId,
          dashboardUrl: outcome.result.dashboardUrl,
          directUrl: outcome.result.directUrl,
          logsUrl: outcome.result.logsUrl,
        };
      }
      if (outcome.status === "canceled") {
        return { status: "failed", error: "Deployment was canceled." };
      }
      return { status: "failed", error: outcome.message };
    } catch (error) {
      return {
        status: "failed",
        error: `Deployment failed: ${describeError(error)}`,
      };
    }
  }
}
