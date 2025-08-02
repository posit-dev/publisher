// Copyright (C) 2025 by Posit Software, PBC.

import {
  useApi,
  Credential,
  SnowflakeConnection,
  ServerType,
  ProductType,
  ProductName,
  ProductDescription,
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

export const getProductType = (serverType: ServerType): ProductType => {
  switch (serverType) {
    case ServerType.CONNECT:
      return ProductType.CONNECT;
    case ServerType.SNOWFLAKE:
      return ProductType.CONNECT;
    case ServerType.CONNECT_CLOUD:
      return ProductType.CONNECT_CLOUD;
  }
};

// List of all available platforms
export const platformList: QuickPickItem[] = [
  {
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: ProductName.CONNECT_CLOUD,
    description: "",
    detail: ProductDescription.CONNECT_CLOUD,
  },
  {
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: ProductName.CONNECT,
    description: "",
    detail: ProductDescription.CONNECT,
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
