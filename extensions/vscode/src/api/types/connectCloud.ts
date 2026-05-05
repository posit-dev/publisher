// Copyright (C) 2025 by Posit Software, PBC.

import type {
  Account,
  DeviceAuthResponse,
  TokenResponse,
} from "@posit-dev/connect-cloud-api";

// Maps the package's DeviceAuthResponse (snake_case) to the extension's
// camelCase shape used by the multi-step UI flow.
export type DeviceAuth = {
  deviceCode: string;
  userCode: string;
  verificationURI: string;
  interval: number;
};

// Maps the package's TokenResponse (snake_case) to the extension's
// camelCase shape used by the multi-step UI flow.
export type AuthToken = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

// Extension-level account type with computed permissionToPublish field.
// The package's Account type has raw permissions: string[] instead.
export type ConnectCloudAccount = {
  id: string;
  name: string;
  displayName: string;
  permissionToPublish: boolean;
};

export type ConnectCloudData = {
  accounts: ConnectCloudAccount[];
  auth: DeviceAuth;
  accountUrl?: string;
  signupUrl?: string;
  shouldPoll?: boolean;
};

// Helper to convert a package DeviceAuthResponse to the extension's DeviceAuth.
export function toDeviceAuth(response: DeviceAuthResponse): DeviceAuth {
  return {
    deviceCode: response.device_code,
    userCode: response.user_code,
    verificationURI: response.verification_uri_complete,
    interval: response.interval,
  };
}

// Helper to convert a package TokenResponse to the extension's AuthToken.
export function toAuthToken(response: TokenResponse): AuthToken {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresIn: response.expires_in,
  };
}

// Helper to convert a package Account to the extension's ConnectCloudAccount.
export function toConnectCloudAccount(account: Account): ConnectCloudAccount {
  return {
    id: account.id,
    name: account.name,
    displayName: account.display_name,
    permissionToPublish: account.permissions.includes("content:create"),
  };
}
