// Copyright (C) 2024 by Posit Software, PBC.

import {
  Credential,
  Configuration,
  ContentRecord,
  PreContentRecord,
} from "../api";

export type DeploymentSelector = {
  deploymentName: string;
  projectDir: string;
  deploymentPath: string;
  configurationName?: string;
};

export type HomeViewState = DeploymentSelector | null;

export type DeploymentObjects = {
  contentRecord: ContentRecord | PreContentRecord;
  configuration: Configuration;
  credential: Credential;
};
