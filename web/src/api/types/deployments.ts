// Copyright (C) 2023 by Posit Software, PBC.

import { ServerType } from 'src/api/types/accounts';
import { ConnectDeployment } from 'src/api/types/connect';
import { Manifest } from 'src/api/types/manifest';

export type Target = {
    accountName: string;
    serverType: ServerType
    serverUrl: string;
    contentId: string;
    contentName: string;
    username: string;
    bundleId: string | null;
}

export type Deployment = {
    sourcePath: string;
    target: Target;
    manifest: Manifest;
    connect: ConnectDeployment;
    pythonRequirements: string[];
}

export type DeploymentModeType = 'new' | 'update';
