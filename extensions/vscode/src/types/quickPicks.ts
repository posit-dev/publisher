// Copyright (C) 2024 by Posit Software, PBC.

import {
  Configuration,
  ConfigurationError,
  ContentRecord,
  Integration,
  PreContentRecordWithConfig,
} from "src/api";
import { QuickPickItem } from "vscode";

export interface DeploymentQuickPick extends QuickPickItem {
  contentRecord?: ContentRecord | PreContentRecordWithConfig;
  config?: Configuration | ConfigurationError;
  credentialName?: string;
  lastMatch?: boolean;
}

export interface IntegrationQuickPick extends QuickPickItem {
  integration: Integration;
}
