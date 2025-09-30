// Copyright (C) 2025 by Posit Software, PBC.

import { ExtensionContext, lm } from "vscode";
import { PublishFailureTroubleshootTool } from "./tooling/troubleshoot/publishFailureTroubleshootTool";

export function registerLLMTooling(context: ExtensionContext) {
  context.subscriptions.push(
    lm.registerTool(
      "publish-content_troubleshootDeploymentFailure",
      new PublishFailureTroubleshootTool(),
    ),
  );
}
