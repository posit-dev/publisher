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
