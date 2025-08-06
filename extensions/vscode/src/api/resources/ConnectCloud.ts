// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { CONNECT_CLOUD_ENV_HEADER } from "../../constants";
import {
  DeviceAuth,
  AuthToken,
  ConnectCloudAccount,
} from "../types/connectCloud";


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
      { headers: CONNECT_CLOUD_ENV_HEADER },
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
      { headers: CONNECT_CLOUD_ENV_HEADER },
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
        ...CONNECT_CLOUD_ENV_HEADER,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }
}
