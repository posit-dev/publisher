// Copyright (C) 2025 by Posit Software, PBC.

import { LogOutputChannel, window } from "vscode";

// Shared output channel for all Posit Publisher logging.
// Uses LogOutputChannel for structured logging with levels.
export const logger: LogOutputChannel = window.createOutputChannel(
  "Posit Publisher",
  { log: true },
);

/**
 * Records a sign-in diagnostic to both the "Posit Publisher" output channel and
 * the host's developer console.
 *
 * The duplication is deliberate. In a browser-based host — Positron or VS Code
 * served by Posit Workbench — the developer console is the log a user can
 * actually open, read, and paste back when reporting that browser sign-in
 * misbehaved, and it is where the extension's other diagnostics already land.
 * The output channel keeps the same lines alongside the rest of Publisher's
 * logging for desktop users. Pass only environment facts, transport decisions,
 * and failure reasons — never tokens, authorization codes, or PKCE verifiers.
 */
export function logSignInDiagnostic(message: string): void {
  logger.info(message);
  console.log(`Posit Publisher: ${message}`);
}
