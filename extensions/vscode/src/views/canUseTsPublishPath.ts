// Copyright (C) 2026 by Posit Software, PBC.

import type { ServerType } from "src/api/types/contentRecords";

/**
 * Determine whether a deployment can use the TypeScript publish path
 * instead of the Go backend. Currently always returns true — all server
 * types and config options are now handled by TypeScript.
 *
 * TODO: Remove this function and its callers.
 */
export function canUseTsPublishPath(_serverType: ServerType): boolean {
  return true;
}
