// Copyright (C) 2025 by Posit Software, PBC.

import {
  Credential,
  ServerType,
  ProductName,
  ProductDescription,
} from "../api";
import { discoverSnowflakeConnections } from "../snowflake/discovery";
import type { SnowflakeConnection } from "../snowflake/types";
import { getSummaryStringFromError } from "../utils/errors";
import { CredentialsService } from "src/credentials/service";
import { isAxiosErrorWithJson } from "../utils/errorTypes";
import { normalizeURL } from "../utils/url";
import {
  InputBoxValidationSeverity,
  QuickPickItem,
  ThemeIcon,
  window,
} from "vscode";
import { extensionSettings } from "src/extension";
import {
  ApiResponse,
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
} from "./multiStepHelper";
import {
  AuthToken,
  ConnectCloudAccount,
  DeviceAuth,
  toAuthToken,
  toConnectCloudAccount,
  toDeviceAuth,
} from "../api/types/connectCloud";
import axios from "axios";
import { showProgress } from "../utils/progress";
import {
  isConnectCloud,
  createNewCredentialLabel,
} from "../utils/multiStepHelpers";
import {
  CloudAuthClient,
  ConnectCloudAPI,
  cloudEnvironmentBaseUrls,
} from "@posit-dev/connect-cloud-api";
import { CONNECT_CLOUD_ENVIRONMENT } from "../constants";

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

// Returns the list of available platforms based on settings
export const getPlatformList = (): QuickPickItem[] => {
  const list: QuickPickItem[] = [];

  if (extensionSettings.enableConnectCloud()) {
    list.push({
      iconPath: new ThemeIcon("posit-publisher-posit-logo"),
      label: ProductName.CONNECT_CLOUD,
      description: "",
      detail: ProductDescription.CONNECT_CLOUD,
    });
  }

  list.push({
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: ProductName.CONNECT,
    description: "",
    detail: ProductDescription.CONNECT,
  });

  return list;
};

// Fetch the list of all available snowflake connections
export const fetchSnowflakeConnections = async (serverUrl: string) => {
  let connections: SnowflakeConnection[];
  let connectionQuickPicks: QuickPickItemWithIndex[];

  try {
    connections = await discoverSnowflakeConnections(serverUrl);
    connectionQuickPicks = connections.map((connection, i) => ({
      label: connection.name,
      index: i,
    }));
  } catch (error: unknown) {
    if (isAxiosErrorWithJson(error)) {
      throw error;
    }
    const summary = getSummaryStringFromError(
      "newCredentials, snowflakeConnections.discover",
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
  const client = new CloudAuthClient(CONNECT_CLOUD_ENVIRONMENT);
  const response = await client.createDeviceAuth();
  return { data: toDeviceAuth(response), intervalAdjustment: 0 };
};

// Fetch the auth token for Connect Cloud
export const fetchAuthToken = async (
  deviceCode: string,
): Promise<ApiResponse<AuthToken>> => {
  const client = new CloudAuthClient(CONNECT_CLOUD_ENVIRONMENT);
  try {
    const response = await client.exchangeToken({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
    });
    return { data: toAuthToken(response), intervalAdjustment: 0 };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 400) {
      const errorCode = err.response.data?.error;
      switch (errorCode) {
        case "slow_down":
          return { intervalAdjustment: 1000 };
        case "authorization_pending":
          return { intervalAdjustment: 0 };
        default:
          throw err;
      }
    }
    throw err;
  }
};

// Fetch the user accounts from Connect Cloud
export const fetchConnectCloudAccounts = async (
  accessToken: string,
): Promise<ApiResponse<ConnectCloudAccount[]>> => {
  const client = new ConnectCloudAPI({
    apiBaseUrl: cloudEnvironmentBaseUrls[CONNECT_CLOUD_ENVIRONMENT],
    accessToken,
  });

  // Check if this is a new user (authenticated with auth service but
  // not yet registered in Connect Cloud)
  try {
    await client.getCurrentUser();
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const errorType = err.response.data?.error_type;
      if (errorType === "no_user_for_lucid_user") {
        return { data: [], intervalAdjustment: 0 };
      }
    }
    throw err;
  }

  // Existing user — fetch their accounts and map to extension type
  const accountsResponse = await client.getAccounts();
  const accounts = accountsResponse.data.map(toConnectCloudAccount);
  return { data: accounts, intervalAdjustment: 0 };
};

// ***************************************************************
// Step: Name the credential (used for all platforms)
// ***************************************************************
export const inputCredentialNameStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  serverType: ServerType,
  productName: ProductName,
  credentials: Credential[],
) => {
  const { name, displayName } = state.data;
  const currentName = typeof name === "string" ? name : "";
  const accountDisplayName = typeof displayName === "string" ? displayName : "";

  const resp = await input.showInputBox({
    title: state.title,
    step: 0,
    totalSteps: 0,
    // default the credential name to the account display name for Connect Cloud when available
    value: currentName || accountDisplayName,
    prompt: `Successfully connected to ${isConnectCloud(serverType) ? "Connect Cloud" : `${state.data.url}`} 🎉
      Enter a unique nickname for this ${isConnectCloud(serverType) ? "account" : "server"}.`,
    placeholder: `${isConnectCloud(serverType) ? accountDisplayName : productName}`,
    finalValidation: (input: string) => {
      input = input.trim();
      if (input === "") {
        return Promise.resolve({
          message: "Error: Invalid Nickname (a value is required).",
          severity: InputBoxValidationSeverity.Error,
        });
      }
      const credInUse = credentials.some((cred) => cred.name === input);
      if (credInUse) {
        return Promise.resolve({
          message:
            "Error: Invalid Nickname (value is already in use by a different credential).",
          severity: InputBoxValidationSeverity.Error,
        });
      }
      if (input === createNewCredentialLabel) {
        return Promise.resolve({
          message:
            "Error: Nickname is reserved for internal use. Please provide another value.",
          severity: InputBoxValidationSeverity.Error,
        });
      }
      return Promise.resolve(undefined);
    },
    shouldResume: () => Promise.resolve(false),
    ignoreFocusOut: true,
  });

  return resp.trim();
};

// ***************************************************************
// Fetch the existing credentials while waiting for the api
// promise to complete while showing progress
// ***************************************************************
export const getExistingCredentials = async (
  viewId: string,
  credentialsService: CredentialsService,
) => {
  let credentials: Credential[] = [];
  try {
    await showProgress("Initializing::newCredential", viewId, async () => {
      credentials = await credentialsService.list();
    });
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newCredentials, credentials.list",
      error,
    );
    window.showWarningMessage(
      `Unable to query existing credentials. ${summary}`,
    );
  }
  return credentials;
};
