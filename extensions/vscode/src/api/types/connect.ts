// Copyright (C) 2023 by Posit Software, PBC.

export type ConnectConfig = {
  access?: ConnectAccess;
  runtime?: ConnectRuntime;
  kubernetes?: ConnectKubernetes;
};

export type ConnectAccess = {
  runAs?: string;
  runAsCurrentUser?: boolean;
};

export type ConnectRuntime = {
  connectionTimeout?: number;
  readTimeout?: number;
  initTimeout?: number;
  idleTimeout?: number;
  maxProcesses?: number;
  minProcesses?: number;
  maxConnections?: number;
  loadFactor?: number;
};

export type ConnectKubernetes = {
  memoryRequest?: number;
  memoryLimit?: number;
  cpuRequest?: number;
  cpuLimit?: number;
  amdGpuLimit?: number;
  nvidiaGpuLimit?: number;
  serviceAccountName?: string;
  imageName?: string;
};

// See types in internal/clients/connect/client.go
// for more information or to add more.
export type LicenseInfo = {
  "oauth-integrations"?: boolean;
};

// See types in internal/clients/connect/client.go
// for more information or to add more.
export type ServerSettings = {
  license?: LicenseInfo;
  oauth_integrations_enabled?: boolean;
};

export type Integration = {
  guid?: string;
  name?: string;
  description?: string;
  auth_type?: string;
  template?: string;
  config?: Record<string, string | undefined>;
  created_time?: string;
};
