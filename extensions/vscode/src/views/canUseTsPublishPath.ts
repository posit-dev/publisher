// Copyright (C) 2026 by Posit Software, PBC.

import { ServerType } from "src/api/types/contentRecords";

/**
 * Determine whether a deployment can use the TypeScript publish path
 * instead of the Go backend. Returns false for server types that are
 * only implemented in Go (Connect Cloud).
 *
 * Note: Snowflake routing is handled separately in homeView.ts.
 * packagesFromLibrary was previously gated here but is now handled
 * by the TypeScript library mapper (rLibraryMapper.ts).
 */
export function canUseTsPublishPath(serverType: ServerType): boolean {
  if (serverType === ServerType.CONNECT_CLOUD) {
    return false;
  }
  return true;
}
