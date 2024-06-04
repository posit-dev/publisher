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

export type DestinationNames = {
  contentRecordName: string;
  configurationName?: string;
};

export type DestinationObjects = {
  contentRecord: ContentRecord | PreContentRecord;
  configuration: Configuration;
  credential: Credential;
};
