// Copyright (C) 2024 by Posit Software, PBC.

export type HomeViewState = {
  deploymentName?: string;
  configurationName?: string;
  credentialName?: string;
};

export type Destination = {
  deploymentName: string;
  configurationName?: string;
  credentialName?: string;
};
