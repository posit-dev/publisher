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

export interface AddCredentialInput {
  /**
   * Optional Posit Connect server URL to pre-fill in the New Credential UI.
   * The user can still edit it. Never pass a Connect Cloud URL — Connect Cloud
   * uses a separate OAuth flow.
   */
  serverUrl?: string;
}

/**
 * Initiate-only tool: open the interactive credential-creation flow so the
 * user enters the API key / completes OAuth in the UI. The secret never enters
 * the model context or this tool's arguments. An optional `serverUrl` is only
 * pre-filled into the URL field — it is not a secret.
 */
export class AddCredentialTool implements LanguageModelTool<AddCredentialInput> {
  async invoke(
    options: LanguageModelToolInvocationOptions<AddCredentialInput>,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const payload = await this.run(options.input ?? {});
    return new LanguageModelToolResult([
      new LanguageModelTextPart(JSON.stringify(payload)),
    ]);
  }

  /**
   * Core logic shared by the `vscode.lm` tool and the Positron agent command.
   * Returns the plain payload object (never wrapped) so both call paths reuse
   * the same implementation.
   */
  async run(input: AddCredentialInput = {}): Promise<unknown> {
    // The command forwards this to newCredential's `startingServerUrl`, which
    // pre-fills the URL field. Passing undefined keeps the existing behavior.
    await commands.executeCommand(
      Commands.HomeView.AddCredential,
      input.serverUrl,
    );
    return {
      status: "initiated",
      message:
        "Opened the New Credential UI. Ask the user to finish entering the credential, then call planDeployment again to see it in the credential list.",
    };
  }
}
