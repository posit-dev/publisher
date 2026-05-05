// Copyright (C) 2026 by Posit Software, PBC.

import type { CapturedRequest } from "./mock-connect-server";

export const Method = {
  TestAuthentication: "TestAuthentication",
  GetCurrentUser: "GetCurrentUser",
  CreateDeployment: "CreateDeployment",
  ContentDetails: "ContentDetails",
  UpdateDeployment: "UpdateDeployment",
  GetEnvVars: "GetEnvVars",
  SetEnvVars: "SetEnvVars",
  UploadBundle: "UploadBundle",
  LatestBundleID: "LatestBundleID",
  DownloadBundle: "DownloadBundle",
  DeployBundle: "DeployBundle",
  WaitForTask: "WaitForTask",
  ValidateDeployment: "ValidateDeployment",
  GetIntegrations: "GetIntegrations",
  GetSettings: "GetSettings",
} as const;

export type MethodName = (typeof Method)[keyof typeof Method];

export type ConnectContractStatus = "success" | "error";

export interface ConnectContractResult<T = unknown> {
  status: ConnectContractStatus;
  result: T;
  capturedRequest: CapturedRequest | null;
  capturedRequests?: CapturedRequest[];
}

export interface ConnectContractClient {
  call(
    method: MethodName,
    params?: Record<string, unknown>,
  ): Promise<ConnectContractResult>;
}
