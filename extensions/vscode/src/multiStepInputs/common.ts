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
import { env, Uri } from "vscode";
import { AuthToken } from "src/api/types/connectCloud";
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

// Authenticate the user in Connect Cloud using device auth and return the token
export const authConnectCloud = async () => {
  let authToken: AuthToken = {
    accessToken: "",
    refreshToken: "",
    expiresIn: 0,
  };

  let errorLocation = "";
  let errorMessage = "";

  try {
    const api = await useApi();
    // get the device auth details like url, code and interval
    const response = await api.connectCloud.auth();
    const { verificationURIComplete, deviceCode, interval } = response.data;
    let pollInterval = (interval / 5) * 1000;

    // open external lucid auth browser window
    env.openExternal(Uri.parse(verificationURIComplete));

    // promesify the interval so we can wait for the polling to complete
    // this is needed because setInterval and setTimeout do not return a promise
    await new Promise((resolve, reject) => {
      // poll for the user's authentication token using the device code
      const pollingToken = setInterval(async () => {
        try {
          const tokenResponse = await api.connectCloud.token(deviceCode);
          authToken = tokenResponse.data;
          // we got the token info, so stop polling for the token
          clearInterval(pollingToken);
          return resolve(authToken);
        } catch (err: unknown) {
          if (axios.isAxiosError(err) && err.response?.data?.code) {
            let errMessage: string | null = null;

            // handle the known polling errors
            switch (err.response.data.code) {
              case "deviceAuthAccessDenied":
                errMessage = "Access denied to Connect Cloud.";
                break;
              case "deviceAuthExpiredToken":
                errMessage = "Expired Connect Cloud authorization token.";
                break;
              case "deviceAuthSlowDown":
                pollInterval *= 2;
                break;
              case "deviceAuthPending":
                // DO NOTHING, let the polling continue, this is expected while authenticating
                break;
              default:
                errMessage =
                  "Unable to retrieve the Connect Cloud authorization token.";
                break;
            }

            // there was a legit error, bail from polling for the token
            if (errMessage) {
              clearInterval(pollingToken);
              errorLocation = "newCredentials, connectCloud.pollToken";
              errorMessage = errMessage;
              return reject(err);
            } else {
              // expected error while authenticating, continue polling
              // return from the interval but not from the promise
              return;
            }
          }

          // there was an unexpected error, bail from polling for the token
          clearInterval(pollingToken);
          errorLocation = "newCredentials, connectCloud.pollToken";
          errorMessage =
            "Unexpected error while retrieving the Connect Cloud authorization token.";
          return reject(err);
        } // catch end
      }, pollInterval); // interval end
    }); // promise end
  } catch (error) {
    errorLocation ||= "newCredentials, connectCloud.auth";
    errorMessage ||= "Unable to authenticate with Connect Cloud.";
    displayError(errorLocation, errorMessage, error);
    throw error;
  }

  return authToken;
};
