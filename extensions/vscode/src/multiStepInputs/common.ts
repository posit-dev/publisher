// Copyright (C) 2025 by Posit Software, PBC.

import {
  useApi,
  Credential,
  SnowflakeConnection,
  ServerType,
  ProductName,
  ProductDescription,
} from "../api";
import { getSummaryStringFromError } from "../utils/errors";
import { isAxiosErrorWithJson } from "../utils/errorTypes";
import { normalizeURL } from "../utils/url";
import {
  InputBoxValidationSeverity,
  QuickPickItem,
  ThemeIcon,
  window,
} from "vscode";
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
} from "../api/types/connectCloud";
import axios from "axios";
import { showProgress } from "../utils/progress";
import {
  isConnectCloud,
  createNewCredentialLabel,
} from "../utils/multiStepHelpers";

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
  try {
    const api = await useApi();
    const resp = await api.connectCloud.token(deviceCode);
    return { data: resp.data, intervalAdjustment: 0 };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.code) {
      // handle the expected polling error codes
      switch (err.response.data.code) {
        case "deviceAuthSlowDown":
          // this is not an actual error, adjust the interval by 1 second
          // and return the promise w/o the `data` property to continue polling
          return { intervalAdjustment: 1000 };
        case "deviceAuthPending":
          // this is not an actual error, this is expected while authenticating
          // just return the promise w/o the `data` property to continue polling
          return { intervalAdjustment: 0 };
        default:
          // bubble up any other errors
          throw err;
      }
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
    prompt: `Enter a unique nickname for this ${isConnectCloud(serverType) ? "account" : "server"}.`,
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
export const getExistingCredentials = async (viewId: string) => {
  let credentials: Credential[] = [];
  try {
    await showProgress("Initializing::newCredential", viewId, async () => {
      const api = await useApi();
      const response = await api.credentials.list();
      credentials = response.data;
    });
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newCredentials, credentials.list",
      error,
    );
    window.showInformationMessage(
      `Unable to query existing credentials. ${summary}`,
    );
  }
  return credentials;
};
