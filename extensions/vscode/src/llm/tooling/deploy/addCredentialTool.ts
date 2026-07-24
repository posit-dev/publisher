// Copyright (C) 2026 by Posit Software, PBC.

import {
  CancellationToken,
  commands,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolResult,
  LanguageModelTextPart,
} from "vscode";
import { Commands } from "src/constants";

/**
 * Initiate-only tool: open the interactive credential-creation flow so the
 * user enters the API key / completes OAuth in the UI. The secret never enters
 * the model context or this tool's arguments.
 */
export class AddCredentialTool
  implements LanguageModelTool<Record<string, never>>
{
  async invoke(
    _options: LanguageModelToolInvocationOptions<Record<string, never>>,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    await commands.executeCommand(Commands.HomeView.AddCredential);
    return new LanguageModelToolResult([
      new LanguageModelTextPart(
        JSON.stringify({
          status: "initiated",
          message:
            "Opened the New Credential UI. Ask the user to finish entering the credential, then call planDeployment again to see it in the credential list.",
        }),
      ),
    ]);
  }
}
