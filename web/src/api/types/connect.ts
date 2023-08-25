// Copyright (C) 2023 by Posit Software, PBC.

export type ConnectContent = {
    name: string;
    title?: string;
    description?: string;
    accessType?: string;
    connectionTimeout: number | null;
    readTimeout: number | null;
    initTimeout: number | null;
    idleTimeout: number | null;
    maxProcesses: number | null;
    minProcesses: number | null;
    maxConnsPerProcess: number | null;
    loadFactor: number | null;
    runAs?: string;
    runAsCurrentUser: boolean | null;
    memoryRequest: number | null;
    memoryLimit: number | null;
    cpuRequest: number | null;
    cpuLimit: number | null;
    serviceAccountName?: string;
    defaultImageName?: string;
}

export type ConnectEnvironmentVariable = {
    name: string;
    value: string | null;
    fromEnvironment: boolean;
}

export type ConnectDeployment = {
    connect: ConnectContent;
    environment: ConnectEnvironmentVariable[];
}
