// Copyright (C) 2025 by Posit Software, PBC.

import { ExtensionContext, lm } from "vscode";
import { PublisherState } from "../state";
import { HomeViewProvider } from "src/views/homeView";
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
  context.subscriptions.push(
    lm.registerTool(
      "publish-content_troubleshootDeploymentFailure",
      new PublishFailureTroubleshootTool(),
    ),
    lm.registerTool(
      "publish-content_troubleshootConfigurationError",
      new ConfigurationTroubleshootTool(state),
    ),
    lm.registerTool(
      "publish-content_planDeployment",
      new PlanDeploymentTool(state),
    ),
    lm.registerTool(
      "publish-content_deployContent",
      new DeployContentTool(
        state,
        homeViewProvider,
        context.extension.packageJSON.version || "unknown",
      ),
    ),
    lm.registerTool("publish-content_addCredential", new AddCredentialTool()),
  );
}
