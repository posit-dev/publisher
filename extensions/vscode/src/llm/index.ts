// Copyright (C) 2025 by Posit Software, PBC.

import { commands, lm } from "vscode";
import { Commands } from "src/constants";
import { normalizeAgentCommandArgs } from "./agentCommandArgs";
import type {
  LLMToolingContext,
  LLMToolingHomeView,
  LLMToolingState,
} from "./types";
import { PublishFailureTroubleshootTool } from "./tooling/troubleshoot/publishFailureTroubleshootTool";
import { ConfigurationTroubleshootTool } from "./tooling/troubleshoot/configurationTroubleshootTool";
import {
  PlanDeploymentTool,
  PlanDeploymentInput,
} from "./tooling/deploy/planDeploymentTool";
import {
  DeployContentTool,
  DeployContentInput,
} from "./tooling/deploy/deployContentTool";
import {
  AddCredentialTool,
  AddCredentialInput,
} from "./tooling/deploy/addCredentialTool";

export function registerLLMTooling(
  context: LLMToolingContext,
  state: LLMToolingState,
  homeViewProvider: LLMToolingHomeView,
) {
  const clientVersion = context.extension.packageJSON.version || "unknown";

  // The three deploy tools are constructed once and exposed two ways so they
  // work in every host: as `vscode.lm` tools (path 1, tagged `positron-assistant`)
  // and as agent-compatible VSCode commands driven by Positron's `positron.ai`
  // allow-list (path 2, see posit-dev/positron#15077). Both paths call the same
  // tool `run()` method.
  const planTool = new PlanDeploymentTool(state);
  const deployTool = new DeployContentTool(
    state,
    homeViewProvider,
    clientVersion,
  );
  const addCredentialTool = new AddCredentialTool();

  context.subscriptions.push(
    // Path 1 — vscode.lm Language Model Tools.
    lm.registerTool(
      "publish-content_troubleshootDeploymentFailure",
      new PublishFailureTroubleshootTool(),
    ),
    lm.registerTool(
      "publish-content_troubleshootConfigurationError",
      new ConfigurationTroubleshootTool(state),
    ),
    lm.registerTool("publish-content_planDeployment", planTool),
    lm.registerTool("publish-content_deployContent", deployTool),
    lm.registerTool("publish-content_addCredential", addCredentialTool),

    // Path 2 — agent-compatible commands for Positron's positron.ai allow-list.
    // Positron's dispatch doesn't consistently use one calling convention —
    // sometimes a single object argument keyed by the `agent.args` names
    // declared in package.json's contributes.commands entries, sometimes the
    // same values spread positionally in that order. normalizeAgentCommandArgs
    // detects which shape arrived and produces the object `run()` expects.
    commands.registerCommand(
      Commands.Agent.PlanDeployment,
      (...raw: unknown[]) =>
        planTool.run(
          normalizeAgentCommandArgs<PlanDeploymentInput>(raw, ["directory"]),
        ),
    ),
    commands.registerCommand(
      Commands.Agent.DeployContent,
      (...raw: unknown[]) =>
        deployTool.run(
          normalizeAgentCommandArgs<DeployContentInput>(raw, [
            "directory",
            "entrypoint",
            "credentialName",
            "title",
            "contentType",
            "deploymentName",
            "configurationName",
          ]),
        ),
    ),
    commands.registerCommand(
      Commands.Agent.AddCredential,
      (...raw: unknown[]) =>
        addCredentialTool.run(
          normalizeAgentCommandArgs<AddCredentialInput>(raw, [
            "serverUrl",
            "target",
            "authMethod",
          ]),
        ),
    ),
  );
}
