// Copyright (C) 2024 by Posit Software, PBC.

import {
  Credential,
  Configuration,
  ContentRecord,
  PreContentRecord,
} from "../api";

export type DeploymentSelector = {
  deploymentPath: string;
};

export type PublishProcessParams = {
  deploymentName: string;
  credentialName: string;
  configurationName: string;
  projectDir: string;
};

export type DeploymentSelectionResult = {
  selector: DeploymentSelector;
  publishParams: PublishProcessParams;
};

export type HomeViewState = DeploymentSelector | null;

export type DeploymentObjects = {
  contentRecord: ContentRecord | PreContentRecord;
  configuration: Configuration;
  credential: Credential;
};
