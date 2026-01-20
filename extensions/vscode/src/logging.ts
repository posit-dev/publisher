// Copyright (C) 2025 by Posit Software, PBC.

import { LogOutputChannel, window } from "vscode";

// Shared output channel for all Posit Publisher logging.
// Uses LogOutputChannel for structured logging with levels.
export const logger: LogOutputChannel = window.createOutputChannel(
  "Posit Publisher",
  { log: true },
);

// Regex to parse Go slog TextHandler output format:
// time=2024-01-15T10:30:00.000Z level=INFO msg="Starting server" key=value
const SLOG_LINE_REGEX = /^time=\S+\s+level=(\w+)\s+msg="([^"]*)"(.*)$/;

// Parse key=value or key="quoted value" pairs from the remainder of a slog line
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match key=value or key="quoted value"
  const attrRegex = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? ""; // quoted or unquoted
    if (key) {
      attrs[key] = value;
    }
  }
  return attrs;
}

// Format attributes for display
function formatAttributes(attrs: Record<string, string>): string {
  const entries = Object.entries(attrs);
  if (entries.length === 0) return "";
  return " " + entries.map(([k, v]) => `${k}=${v}`).join(" ");
}

/**
 * Parse a line of Go slog TextHandler output and log it with the appropriate level.
 * If the line doesn't match the expected format, log it as-is at info level.
 */
export function logAgentOutput(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  const match = SLOG_LINE_REGEX.exec(trimmed);
  if (match && match[1] && match[2]) {
    const level = match[1].toUpperCase();
    const message = match[2];
    const attrs = parseAttributes(match[3] ?? "");
    const formattedAttrs = formatAttributes(attrs);
    const fullMessage = `[agent] ${message}${formattedAttrs}`;

    switch (level) {
      case "DEBUG":
        logger.debug(fullMessage);
        break;
      case "INFO":
        logger.info(fullMessage);
        break;
      case "WARN":
      case "WARNING":
        logger.warn(fullMessage);
        break;
      case "ERROR":
        logger.error(fullMessage);
        break;
      default:
        logger.info(fullMessage);
    }
  } else {
    // Line doesn't match slog format - log as-is (could be panic, stack trace, etc.)
    logger.info(`[agent] ${trimmed}`);
  }
}
