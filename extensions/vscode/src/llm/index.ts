// Copyright (C) 2025 by Posit Software, PBC.

import { commands, ExtensionContext, lm } from "vscode";
import { PublisherState } from "../state";
import { HomeViewProvider } from "src/views/homeView";
import { Commands } from "src/constants";
import { PublishFailureTroubleshootTool } from "./tooling/troubleshoot/publishFailureTroubleshootTool";
import { ConfigurationTroubleshootTool } from "./tooling/troubleshoot/configurationTroubleshootTool";
import { PlanDeploymentTool } from "./tooling/deploy/planDeploymentTool";
import { DeployContentTool } from "./tooling/deploy/deployContentTool";
import { AddCredentialTool } from "./tooling/deploy/addCredentialTool";

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
    // Args are positional, matching the `agent.args` order declared in
    // package.json's contributes.commands entries.
    commands.registerCommand(
      Commands.Agent.PlanDeployment,
      (directory?: string) => planTool.run({ directory }),
    ),
    commands.registerCommand(
      Commands.Agent.DeployContent,
      (
        directory: string,
        entrypoint: string,
        credentialName: string,
        title?: string,
        contentType?: string,
        deploymentName?: string,
        configurationName?: string,
      ) =>
        deployTool.run({
          directory,
          entrypoint,
          credentialName,
          title,
          contentType,
          deploymentName,
          configurationName,
        }),
    ),
    commands.registerCommand(Commands.Agent.AddCredential, () =>
      addCredentialTool.run(),
    ),
  );
}
