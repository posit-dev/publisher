// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import {
  ConnectCloudAccount,
  AuthToken,
  DeviceAuth,
} from "../types/connectCloud";
import { CONNECT_CLOUD_ENV } from "../../constants";

const envHeader = { "Connect-Cloud-Environment": CONNECT_CLOUD_ENV };

export class ConnectCloud {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Get the Connect Cloud auth URI to authenticate a user
  //
  // Returned properties includes the verification URI, which can be use to
  // kick-off the device auth workflow in Connect Cloud
  //
  // Returns:
  // 200 - ok
  // 400 - bad request error
  // 500 - internal server error
  auth() {
    return this.client.post<DeviceAuth>(
      "connect-cloud/device-auth",
      {},
      { headers: envHeader },
    );
  }

  // Get the Connect Cloud auth token for the authenticated user
  //
  // Returned properties includes access token and refresh token
  //
  // Returns:
  // 200 - ok
  // 400 - bad request error
  // 500 - internal server error
  token(deviceCode: string) {
    return this.client.post<AuthToken>(
      "connect-cloud/oauth/token",
      { deviceCode },
      { headers: envHeader },
    );
  }

  // Get the user's account list from Connect Cloud
  //
  // Returned accounts include non-publishable accounts for the user
  //
  // Returns:
  // 200 - ok
  // 400 - bad request error
  // 500 - internal server error
  accounts(accessToken: string) {
    return this.client.get<ConnectCloudAccount[]>("connect-cloud/accounts", {
      headers: {
        ...envHeader,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }
}
