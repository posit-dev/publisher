// Copyright (C) 2026 by Posit Software, PBC.

// Connect URL helpers. Ports Go's util.GetDashboardURL, GetLogsURL, GetDirectURL.

export function getDashboardUrl(serverUrl: string, contentId: string): string {
  return `${serverUrl}/connect/#/apps/${contentId}`;
}

export function getLogsUrl(serverUrl: string, contentId: string): string {
  return `${getDashboardUrl(serverUrl, contentId)}/logs`;
}

export function getDirectUrl(serverUrl: string, contentId: string): string {
  return `${serverUrl}/content/${contentId}/`;
}
