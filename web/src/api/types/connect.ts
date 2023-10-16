// Copyright (C) 2023 by Posit Software, PBC.

export type ConnectContent = {
    name: string;
    title?: string;
    description?: string;
}

export type ConnectEnvironmentVariable = {
    name: string;
    value: string | null;
    fromEnvironment: boolean;
}

export type ConnectDeployment = {
    content: ConnectContent;
    environment: ConnectEnvironmentVariable[];
}
