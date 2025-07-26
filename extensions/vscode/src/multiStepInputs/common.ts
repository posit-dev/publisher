// Copyright (C) 2025 by Posit Software, PBC.

import {
  useApi,
  Credential,
  SnowflakeConnection,
  PlatformName,
  PlatformDescription,
  ServerType,
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

export const isConnect = (serverType: ServerType) => {
  return serverType === ServerType.CONNECT;
};

export const isConnectCloud = (serverType: ServerType) => {
  return serverType === ServerType.CONNECT_CLOUD;
};

export const isSnowflake = (serverType: ServerType) => {
  return serverType === ServerType.SNOWFLAKE;
};

export const displayError = (
  location: string,
  message: string,
  error: unknown,
) => {
  window.showErrorMessage(
    `${message} ${getSummaryStringFromError(location, error)}`,
  );
};

// List of all available platforms
export const platformList: QuickPickItem[] = [
  {
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: PlatformName.CONNECT_CLOUD,
    description: "",
    detail: PlatformDescription.CONNECT_CLOUD,
  },
  {
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: PlatformName.CONNECT,
    description: "",
    detail: PlatformDescription.CONNECT,
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
    displayError(
      "newCredentials, snowflakeConnections.list",
      "Unable to query Snowflake connections.",
      error,
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
