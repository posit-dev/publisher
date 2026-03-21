// Copyright (C) 2026 by Posit Software, PBC.

import { ServerType } from "src/api/types/contentRecords";
import type { ConfigurationDetails } from "src/api/types/configurations";

/**
 * Determine whether a deployment can use the TypeScript publish path
 * instead of the Go backend. Returns false for server types or config
 * options that are only implemented in Go.
 */
export function canUseTsPublishPath(
  serverType: ServerType,
  config: ConfigurationDetails,
): boolean {
  if (
    serverType === ServerType.CONNECT_CLOUD ||
    serverType === ServerType.SNOWFLAKE
  ) {
    return false;
  }
  if (config.r?.packagesFromLibrary) {
    return false;
  }
  return true;
}
