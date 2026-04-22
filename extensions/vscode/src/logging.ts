// Copyright (C) 2025 by Posit Software, PBC.

import { LogOutputChannel, window } from "vscode";

// Shared output channel for all Posit Publisher logging.
// Uses LogOutputChannel for structured logging with levels.
export const logger: LogOutputChannel = window.createOutputChannel(
  "Posit Publisher",
  { log: true },
);
