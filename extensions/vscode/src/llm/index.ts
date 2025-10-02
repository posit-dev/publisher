// Copyright (C) 2025 by Posit Software, PBC.

import { ExtensionContext, lm } from "vscode";
import { PublisherState } from "../state";
import { PublishFailureTroubleshootTool } from "./tooling/troubleshoot/publishFailureTroubleshootTool";
import { ConfigurationTroubleshootTool } from "./tooling/troubleshoot/configurationTroubleshootTool";

export function registerLLMTooling(
  context: ExtensionContext,
  state: PublisherState,
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
  );
}
