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
} from "src/api/types/contentRecords";
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
export class PlanDeploymentTool
  implements LanguageModelTool<PlanDeploymentInput>
{
  constructor(private readonly state: PublisherState) {}

  async invoke(
    options: LanguageModelToolInvocationOptions<PlanDeploymentInput>,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const root = workspaces.path();
    if (!root) {
      return this.result({ error: "No workspace folder is open." });
    }

    const relDir = options.input?.directory ?? ".";
    const absDir = path.resolve(root, relDir);

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

    return this.result({
      projectDir: relDir,
      interpreters: {
        python: interpreters.python,
        r: interpreters.r,
      },
      candidates,
      existingConfigurations,
      existingDeployments,
      credentials: credentials.map(redactCredential),
    });
  }

  private result(payload: unknown): LanguageModelToolResult {
    return new LanguageModelToolResult([
      new LanguageModelTextPart(JSON.stringify(payload, null, 2)),
    ]);
  }
}
