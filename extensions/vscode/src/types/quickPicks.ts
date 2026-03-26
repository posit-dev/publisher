// Copyright (C) 2024 by Posit Software, PBC.

import {
  Configuration,
  ConfigurationError,
  ContentRecord,
  PreContentRecordWithConfig,
} from "src/api";
import type { Integration } from "@posit-dev/connect-api";
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
