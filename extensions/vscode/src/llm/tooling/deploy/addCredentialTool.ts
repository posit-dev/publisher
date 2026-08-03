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
import type { AddCredentialOutcome } from "src/views/homeView";
import { ServerType } from "src/api/types/contentRecords";

export interface AddCredentialInput {
  /**
   * Optional Posit Connect server URL to pre-fill in the New Credential UI.
   * Only applies when targeting a Connect server, not Connect Cloud.
   */
  serverUrl?: string;
  /**
   * Which product the deployment targets, if known. Set this only when the
   * user's intent is clear from context; leave it unset to let the user
   * choose in the UI.
   */
  target?: "connect" | "connect-cloud";
  /**
   * Only used when targeting a Connect server with a known serverUrl:
   * "browser" (the default) signs the user in automatically; "apiKey" lets
   * the user paste one in instead. Set "apiKey" only when the user explicitly
   * asked to enter one manually.
   */
  authMethod?: "browser" | "apiKey";
}

export type AddCredentialResult =
  | {
      status: "added";
      credentialName: string;
      message: string;
    }
  | {
      status: "canceled";
      message: string;
    };

/**
 * Open the interactive credential-creation flow and wait for the user to
 * finish or dismiss it. The secret material never enters the model context
 * or this tool's arguments — the user completes authentication in the UI.
 * `serverUrl` only pre-fills the URL field; it is not a secret.
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
  async run(input: AddCredentialInput = {}): Promise<AddCredentialResult> {
    // A server URL only makes sense for a Connect server (Connect Cloud has
    // none), so it doubles as a target hint when the caller didn't say so
    // explicitly.
    const target = input.target ?? (input.serverUrl ? "connect" : undefined);
    const serverType =
      target === "connect-cloud"
        ? ServerType.CONNECT_CLOUD
        : target === "connect"
          ? ServerType.CONNECT
          : undefined;

    // Only auto-trigger the browser sign-in shortcut when both signals line
    // up: confident it's a Connect server, and a URL to sign in to. Anything
    // less certain falls back to the fully manual flow, and an explicit
    // request for an API key always keeps auth manual.
    const authMethodHint =
      target === "connect" && input.serverUrl
        ? (input.authMethod ?? "browser")
        : undefined;

    const outcome = await commands.executeCommand<AddCredentialOutcome>(
      Commands.HomeView.AddCredential,
      input.serverUrl,
      serverType,
      authMethodHint,
    );

    if (outcome?.status === "added") {
      return {
        status: "added",
        credentialName: outcome.credentialName,
        message: `Credential "${outcome.credentialName}" was added. Continue the deployment now.`,
      };
    }
    return {
      status: "canceled",
      message:
        "The user canceled credential creation. Ask them how they'd like to proceed.",
    };
  }
}
