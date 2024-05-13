// Copyright (C) 2024 by Posit Software, PBC.

import {
  Credential,
  Configuration,
  Deployment,
  PreDeploymentWithConfig,
} from "src/api";
import { QuickPickItem } from "vscode";

export interface DestinationQuickPick extends QuickPickItem {
  deployment: Deployment | PreDeploymentWithConfig;
  config?: Configuration;
  credential?: Credential;
  credentialName: string;
  lastMatch: boolean;
}
