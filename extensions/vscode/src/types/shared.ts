// Copyright (C) 2024 by Posit Software, PBC.

import {
  Credential,
  Configuration,
  ContentRecord,
  PreContentRecord,
} from "../api";

export type DeploymentSelector = {
  deploymentName: string;
  deploymentPath: string;
  projectDir: string;
};

export type PublishProcessParams = DeploymentSelector & {
  credentialName: string;
  configurationName: string;
};

export type DeploymentSelectorState = DeploymentSelector & {
  version: "v1";
};

export type SelectionState = DeploymentSelectorState | null;

export type DeploymentObjects = {
  contentRecord: ContentRecord | PreContentRecord;
  configuration: Configuration;
  credential: Credential;
};

export type RExecutable = {
  rPath: string;
};
export function NewRExecutable(rPath: string): RExecutable {
  return {
    rPath,
  };
}

export type PythonExecutable = {
  pythonPath: string;
};
export function NewPythonExecutable(pythonPath: string): PythonExecutable {
  return {
    pythonPath,
  };
}
