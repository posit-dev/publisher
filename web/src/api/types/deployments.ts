// Copyright (C) 2023 by Posit Software, PBC.

import { ServerType } from 'src/api/types/accounts';
import { ConnectDeployment } from 'src/api/types/connect';
import { Manifest } from 'src/api/types/manifest';

export type Target = {
    account_name: string;
    server_type: ServerType
    server_url: string;
    content_id: string;
    content_name: string;
    username: string;
    bundle_id: string | null;
    deployed_at: number | null;
}

export type Deployment = {
    source_dir: string;
    target: Target;
    manifest: Manifest;
    connect: ConnectDeployment;
    python_requirements: string[];
}
