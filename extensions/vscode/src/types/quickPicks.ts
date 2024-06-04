// Copyright (C) 2024 by Posit Software, PBC.

import {
  Configuration,
  ContentRecord,
  PreContentRecordWithConfig,
} from "src/api";
import { QuickPickItem } from "vscode";

export interface DestinationQuickPick extends QuickPickItem {
  contentRecord: ContentRecord | PreContentRecordWithConfig;
  config?: Configuration;
  lastMatch: boolean;
}
