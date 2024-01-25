// Copyright (C) 2023 by Posit Software, PBC.

import { InjectionKey } from 'vue';

import { Deployment, DeploymentError, PreDeployment } from 'src/api';

export const deploymentKey = Symbol('deployment') as InjectionKey<
    PreDeployment |
    Deployment |
    DeploymentError |
    undefined
>;
