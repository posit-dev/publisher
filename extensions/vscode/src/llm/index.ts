// Copyright (C) 2025 by Posit Software, PBC.

import { commands, ExtensionContext, lm } from "vscode";
import { PublisherState } from "../state";
import { HomeViewProvider } from "src/views/homeView";
import { Commands } from "src/constants";
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
  context: ExtensionContext,
  state: PublisherState,
  homeViewProvider: HomeViewProvider,
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
    // Positron invokes these with a single object argument keyed by the
    // `agent.args` names declared in package.json's contributes.commands
    // entries — NOT spread positionally — so each handler takes one input
    // object, matching the shape `run()` already expects.
    commands.registerCommand(
      Commands.Agent.PlanDeployment,
      (input: PlanDeploymentInput = {}) => planTool.run(input),
    ),
    commands.registerCommand(
      Commands.Agent.DeployContent,
      (input: DeployContentInput) => deployTool.run(input),
    ),
    commands.registerCommand(
      Commands.Agent.AddCredential,
      (input: AddCredentialInput = {}) => addCredentialTool.run(input),
    ),
  );
}
