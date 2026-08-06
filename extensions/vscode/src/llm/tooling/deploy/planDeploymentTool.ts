// Copyright (C) 2026 by Posit Software, PBC.

import {
  CancellationToken,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolResult,
  LanguageModelTextPart,
} from "vscode";
import * as workspaces from "src/workspaces";
import { PublisherState } from "src/state";
import { inspectProject } from "src/inspect";
import { getInterpreterDefaults } from "src/interpreters";
import { loadAllConfigurations, loadAllDeployments } from "src/toml";
import { isConfigurationError, isContentRecordError } from "src/api";
import {
  Configuration,
  ConfigurationError,
} from "src/api/types/configurations";
import {
  AllContentRecordTypes,
  ContentRecordError,
  ServerType,
} from "src/api/types/contentRecords";
import { extensionSettings } from "src/extension";
import { redactCredential } from "./redactCredential";

export interface PlanDeploymentInput {
  directory?: string;
}

/**
 * Read-only tool: inspect a project directory and report what can be deployed
 * (content type + entrypoint candidates), interpreter defaults, existing
 * configurations and deployment records, and the available server credentials
 * (names and URLs only — never secrets).
 */
export class PlanDeploymentTool implements LanguageModelTool<PlanDeploymentInput> {
  constructor(private readonly state: PublisherState) {}

  async invoke(
    options: LanguageModelToolInvocationOptions<PlanDeploymentInput>,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const payload = await this.run(options.input ?? {});
    return this.result(payload);
  }

  /**
   * Core logic shared by the `vscode.lm` tool and the Positron agent command.
   * Returns the plain payload object (never wrapped) so both call paths reuse
   * the same implementation.
   */
  async run(input: PlanDeploymentInput): Promise<unknown> {
    const root = workspaces.path();
    if (!root) {
      return { error: "No workspace folder is open." };
    }

    const relDir = input?.directory ?? ".";
    const resolvedDir = workspaces.resolveWithinWorkspace(root, relDir);
    if (!resolvedDir.ok) {
      return { error: resolvedDir.error };
    }
    const absDir = resolvedDir.absPath;

    const [inspections, interpreters, configs, deployments, credentials] =
      await Promise.all([
        inspectProject({ projectDir: absDir, relativeDir: relDir }),
        getInterpreterDefaults(absDir),
        loadAllConfigurations(relDir, root),
        loadAllDeployments(relDir, root),
        this.state.credentialsService.list(),
      ]);

    const candidates = inspections.map((i) => ({
      entrypoint: i.configuration.entrypoint,
      contentType: i.configuration.type,
      title: i.configuration.title,
    }));

    const existingConfigurations = configs
      .filter((c: Configuration | ConfigurationError): c is Configuration => {
        return !isConfigurationError(c);
      })
      .map((c) => ({
        name: c.configurationName,
        entrypoint: c.configuration.entrypoint,
        type: c.configuration.type,
      }));

    const existingDeployments = deployments
      .filter(
        (
          d: AllContentRecordTypes,
        ): d is Exclude<AllContentRecordTypes, ContentRecordError> => {
          return !isContentRecordError(d);
        },
      )
      .map((d) => ({ name: d.deploymentName }));

    // Exclude Connect Cloud credentials while the setting is off so the
    // agent never plans a deployment against a disabled target.
    const availableCredentials = extensionSettings.enableConnectCloud()
      ? credentials
      : credentials.filter((c) => c.serverType !== ServerType.CONNECT_CLOUD);

    return {
      projectDir: relDir,
      interpreters: {
        python: interpreters.python,
        r: interpreters.r,
      },
      candidates,
      existingConfigurations,
      existingDeployments,
      credentials: availableCredentials.map(redactCredential),
    };
  }

  private result(payload: unknown): LanguageModelToolResult {
    return new LanguageModelToolResult([
      new LanguageModelTextPart(JSON.stringify(payload, null, 2)),
    ]);
  }
}
