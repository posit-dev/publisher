// Copyright (C) 2026 by Posit Software, PBC.

import type { ExtensionContext, CancellationToken } from "vscode";
import type { Credential } from "src/api/types/credentials";
import type {
  Configuration,
  ConfigurationError,
} from "src/api/types/configurations";
import type { CredentialsService } from "src/credentials/service";
import type { DeployOutcome } from "src/views/deployProgress";

export interface LLMToolingContext {
  readonly subscriptions: ExtensionContext["subscriptions"];
  readonly extension: Pick<ExtensionContext["extension"], "packageJSON">;
}

export interface LLMToolingState {
  readonly credentialsService: Pick<CredentialsService, "list">;
  refreshCredentials(): Promise<void>;
  findCredential(name: string): Credential | undefined;
  getSelectedConfiguration(): Promise<
    Configuration | ConfigurationError | undefined
  >;
}

export interface LLMToolingHomeView {
  deployProject(
    deploymentName: string,
    credentialName: string,
    configurationName: string,
    projectDir: string,
    cancellationToken?: CancellationToken,
  ): Promise<DeployOutcome>;
}
