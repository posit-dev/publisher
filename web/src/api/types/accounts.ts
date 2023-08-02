// Copyright (C) 2023 by Posit Software, PBC.

export enum ServerType {
    CONNECT = 'connect',
    SHINY_APPS = 'shinyapps',
    CLOUD = 'cloud',
}

export enum AccountSource {
    RSCONNECT_PYTHON = 'rsconnect-python',
    RSCONNECT = 'rsconnect',
    ENVIRONMENT = 'environment',
}

export enum AccountAuthType {
    NONE = 'none',
    API_KEY = 'api-key',
    TOKEN_KEY = 'token-key',
    TOKEN_SECRET = 'token-secret',
}

export type Account = {
    account_name: string;
    auth_type: AccountAuthType;
    ca_cert: string;
    insecure: boolean;
    name: string;
    source: AccountSource;
    type: ServerType;
    url: string;
}
