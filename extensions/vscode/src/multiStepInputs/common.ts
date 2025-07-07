// Copyright (C) 2025 by Posit Software, PBC.

import {
  useApi,
  Credential,
  SnowflakeConnection,
  PlatformName,
  PlatformDescription,
} from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import { isAxiosErrorWithJson } from "src/utils/errorTypes";
import { normalizeURL } from "src/utils/url";
import { QuickPickItem, ThemeIcon, window } from "vscode";
import { QuickPickItemWithIndex } from "./multiStepHelper";

// Search for the first credential that includes
// the targetURL.
export function findExistingCredentialByURL(
  credentials: Credential[],
  targetURL: string,
): Credential | undefined {
  return credentials.find((credential) => {
    const existing = normalizeURL(credential.url).toLowerCase();
    const newURL = normalizeURL(targetURL).toLowerCase();
    return newURL.includes(existing);
  });
}

// List of all available platforms
export const platformList: QuickPickItem[] = [
  {
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: PlatformName.CONNECT,
    description: "",
    detail: PlatformDescription.CONNECT,
  },
  {
    iconPath: new ThemeIcon("posit-publisher-snowflake-logo"),
    label: PlatformName.SNOWFLAKE,
    description: "",
    detail: PlatformDescription.SNOWFLAKE,
  },
];

// Fetch the list of all available snowflake connections
export const fetchSnowflakeConnections = async (serverUrl: string) => {
  let connections: SnowflakeConnection[] = [];
  let connectionQuickPicks: QuickPickItemWithIndex[];

  try {
    const api = await useApi();
    const connsResponse = await api.snowflakeConnections.list(serverUrl);
    connections = connsResponse.data;
    connectionQuickPicks = connections.map((connection, i) => ({
      label: connection.name,
      index: i,
    }));
  } catch (error: unknown) {
    if (isAxiosErrorWithJson(error)) {
      throw error;
    }
    const summary = getSummaryStringFromError(
      "newCredentials, snowflakeConnections.list",
      error,
    );
    window.showErrorMessage(
      `Unable to query Snowflake connections. ${summary}`,
    );
    throw error;
  }

  if (!connectionQuickPicks.length) {
    const msg = `No working Snowflake connections found for ${serverUrl}. Please configure a connection in your environment before creating a credential.`;
    window.showErrorMessage(msg);
    throw new Error(msg);
  }

  return { connections, connectionQuickPicks };
};
