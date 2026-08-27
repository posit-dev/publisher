// Copyright (C) 2026 by Posit Software, PBC.

import { extensions } from "vscode";

/**
 * Returns the installed extension's version, e.g. "2.11.4", or "unknown" when
 * it cannot be determined.
 */
export function getExtensionVersion(): string {
  return (
    extensions.getExtension("posit.publisher")?.packageJSON.version || "unknown"
  );
}

/**
 * Builds the User-Agent header value sent on requests to Connect and Connect
 * Cloud, e.g. "PositPublisher/2.11.4".
 */
export function getUserAgent(): string {
  return `PositPublisher/${getExtensionVersion()}`;
}
