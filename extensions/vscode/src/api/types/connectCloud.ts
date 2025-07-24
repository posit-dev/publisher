// Copyright (C) 2025 by Posit Software, PBC.

export type DeviceAuth = {
  deviceCode: string;
  userCode: string;
  verificationURIComplete: string;
  interval: number;
};

export type AuthToken = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type ConnectCloudAccount = {
  name: string;
  id: string;
  permissionToPublish: boolean;
};
