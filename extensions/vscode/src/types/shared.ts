// Copyright (C) 2024 by Posit Software, PBC.

import { Credential, Configuration, Deployment, PreDeployment } from "../api";

export type HomeViewState = {
  deploymentName?: string;
  configurationName?: string;
  credentialName?: string;
};

export type DestinationNames = {
  deploymentName: string;
  configurationName?: string;
  credentialName?: string;
};

export type DestinationObjects = {
  deployment: Deployment | PreDeployment;
  configuration: Configuration;
  credential: Credential;
};
