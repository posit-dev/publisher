// Copyright (C) 2026 by Posit Software, PBC.

import path from "path";
import {
  CancellationToken,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolResult,
  LanguageModelTextPart,
} from "vscode";
import * as workspaces from "src/workspaces";
import { PublisherState } from "src/state";
import { HomeViewProvider } from "src/views/homeView";
import { inspectProject } from "src/inspect";
import {
  writeConfigToFile,
  createDeploymentRecord,
  loadAllConfigurations,
  loadAllDeployments,
} from "src/toml";
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

/**
 * Deploy a project to Posit Connect or Connect Cloud. Creates a configuration
 * and deployment record if none are supplied, then runs the headless deploy and
 * returns a structured result. Never accepts secrets — the target is named by
 * an existing stored credential.
 */
export class DeployContentTool implements LanguageModelTool<DeployContentInput> {
  constructor(
    private readonly state: PublisherState,
    private readonly homeViewProvider: HomeViewProvider,
    private readonly clientVersion: string,
  ) {}

  async invoke(
    options: LanguageModelToolInvocationOptions<DeployContentInput>,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const result = await this.run(options.input);
    return new LanguageModelToolResult([
      new LanguageModelTextPart(JSON.stringify(result, null, 2)),
    ]);
  }

  /**
   * Core logic shared by the `vscode.lm` tool and the Positron agent command.
   * Returns the structured result object (never wrapped) so both call paths
   * reuse the same implementation.
   */
  async run(input: DeployContentInput): Promise<DeployToolResult> {
    const root = workspaces.path();
    if (!root) {
      return { status: "failed", error: "No workspace folder is open." };
    }
    const relDir = input.directory || ".";
    const absDir = path.resolve(root, relDir);

    const credential = this.state.findCredential(input.credentialName);
    if (!credential) {
      const all = await this.state.credentialsService.list();
      return {
        status: "needs-credential",
        message: `No stored credential named "${input.credentialName}". Call addCredential (with target/serverUrl if known from context) and wait for its result — if it reports "added", call deployContent again with the same arguments to continue automatically. If it reports "canceled", ask the user how they'd like to proceed, or offer to pick from the available list.`,
        availableCredentials: all.map((c) => c.name),
      };
    }

    // Resolve the configuration: reuse an existing one, or create a new one.
    let configName = input.configurationName;
    if (!configName) {
      const inspections = await inspectProject({
        projectDir: absDir,
        entrypoint: input.entrypoint,
        relativeDir: relDir,
      });
      const match =
        inspections.find(
          (i) => i.configuration.entrypoint === input.entrypoint,
        ) ?? inspections[0];
      if (!match) {
        return {
          status: "failed",
          error: `Nothing deployable found for ${input.entrypoint}.`,
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
      };

      const existingConfigs = await loadAllConfigurations(relDir, root);
      const existingConfigNames = existingConfigs
        .filter((c: Configuration | ConfigurationError): c is Configuration => {
          return !isConfigurationError(c);
        })
        .map((c) => c.configurationName);
      configName = newConfigFileNameFromTitle(
        configDetails.title || input.entrypoint,
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
      input.credentialName,
      configName,
      relDir,
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
  }
}
