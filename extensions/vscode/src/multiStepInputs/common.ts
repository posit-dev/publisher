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
import { ApiResponse, QuickPickItemWithIndex } from "./multiStepHelper";
import {
  AuthToken,
  ConnectCloudAccount,
  DeviceAuth,
} from "src/api/types/connectCloud";
import axios from "axios";

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

export const getPublishableAccounts = (accounts: ConnectCloudAccount[]) => {
  return accounts.filter((a) => a.permissionToPublish);
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

// Fetch the device auth for Connect Cloud
export const fetchDeviceAuth = async (): Promise<ApiResponse<DeviceAuth>> => {
  const api = await useApi();
  const resp = await api.connectCloud.auth();
  return { data: resp.data, intervalAdjustment: 0 };
};

// Fetch the auth token for Connect Cloud
export const fetchAuthToken = async (
  deviceCode: string,
): Promise<ApiResponse<AuthToken>> => {
  let intervalAdjustment = 0;
  try {
    const api = await useApi();
    const resp = await api.connectCloud.token(deviceCode);
    return { data: resp.data, intervalAdjustment };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.code) {
      // handle the expected polling errors
      switch (err.response.data.code) {
        case "deviceAuthSlowDown":
          // adjust the interval by 1 second
          intervalAdjustment = 1000;
          break;
        case "deviceAuthPending":
          // DO NOTHING, this is expected while authenticating
          break;
        default:
          // bubble up any other errors
          throw err;
      }
      // this is not an actual error so return the promise w/o the `data` property
      return { intervalAdjustment };
    } else {
      // there was an unexpected error, bubble up the error
      throw err;
    }
  }
};

// Fetch the user accounts from Connect Cloud
export const fetchConnectCloudAccounts = async (
  accessToken: string,
): Promise<ApiResponse<ConnectCloudAccount[]>> => {
  const api = await useApi();
  const resp = await api.connectCloud.accounts(accessToken);
  return { data: resp.data, intervalAdjustment: 0 };
};
