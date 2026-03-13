// Copyright (C) 2026 by Posit Software, PBC.

import { ServerType } from "src/api/types/contentRecords";

/**
 * Infer a server type from the server URL.
 * Port of internal/server_type/server_type.go:ServerTypeFromURL
 */
export function serverTypeFromURL(urlStr: string): ServerType {
  const host = new URL(urlStr).hostname;
  if (host.endsWith("connect.posit.cloud")) {
    return ServerType.CONNECT_CLOUD;
  }
  if (
    host.endsWith(".snowflakecomputing.app") ||
    host.endsWith(".privatelink.snowflake.app")
  ) {
    return ServerType.SNOWFLAKE;
  }
  return ServerType.CONNECT;
}

/**
 * Normalize a server URL by removing trailing slashes, duplicate slashes,
 * and resolving dot segments.
 * Port of internal/util/urls.go:NormalizeServerURL
 */
export function normalizeServerURL(urlStr: string): string {
  const u = new URL(urlStr);
  // new URL() resolves dot segments natively
  // Collapse duplicate slashes in path
  let path = u.pathname.replace(/\/\/+/g, "/");
  // Remove trailing slash (unless root "/")
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return `${u.protocol}//${u.host}${path}`;
}

/**
 * Returns true for CONNECT or SNOWFLAKE server types.
 * Port of internal/server_type/server_type.go:IsConnectLike
 */
export function isConnectLike(t: ServerType): boolean {
  return t === ServerType.CONNECT || t === ServerType.SNOWFLAKE;
}
