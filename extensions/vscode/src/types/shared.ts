// Copyright (C) 2024 by Posit Software, PBC.

import {
  Credential,
  Configuration,
  ContentRecord,
  PreContentRecord,
} from "../api";

export type HomeViewState = {
  contentRecordName?: string;
  configurationName?: string;
};

export type DeploymentNames = {
  contentRecordName: string;
  configurationName?: string;
};

export type DeploymentObjects = {
  contentRecord: ContentRecord | PreContentRecord;
  configuration: Configuration;
  credential: Credential;
};
