// Copyright (C) 2026 by Posit Software, PBC.

import { extensions } from "vscode";

/**
 * Builds the User-Agent header value sent on requests to Connect and Connect
 * Cloud, e.g. "PositPublisher/2.11.4".
 */
export function getUserAgent(): string {
  const version =
    extensions.getExtension("posit.publisher")?.packageJSON.version ||
    "unknown";
  return `PositPublisher/${version}`;
}
