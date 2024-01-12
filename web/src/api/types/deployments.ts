// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from 'src/api/types/error';
import { Configuration } from 'src/api/types/configurations';
import { SchemaURL } from 'src/api/types/schema';
import { ServerType } from 'src/api/types/accounts';

export enum DeploymentState {
  NEW = 'new',
  DEPLOYED = 'deployed',
  ERROR = 'error',
}

export type DeploymentLocation = {
  deploymentName: string;
  deploymentPath: string;
}

export type DeploymentRecordError = {
  error: AgentError,
  state: DeploymentState.ERROR,
} & DeploymentLocation

type DeploymentRecord = {
  $schema: SchemaURL,
  serverType: ServerType,
  serverUrl: string,
  saveName: string,
} & DeploymentLocation;

export type PreDeployment = {
  state: DeploymentState.NEW,
} & DeploymentRecord;

export type Deployment = {
  id: string,
  bundleId: string,
  bundleUrl: string,
  dashboardUrl: string,
  directUrl: string,
  files: string[],
  deployedAt: string,
  state: DeploymentState.DEPLOYED,
} & DeploymentRecord & Configuration;

export function isDeploymentRecordError(
  d: Deployment | PreDeployment | DeploymentRecordError
): d is DeploymentRecordError {
  return d.state === DeploymentState.ERROR;
}

export function isPreDeployment(
  d: Deployment | PreDeployment | DeploymentRecordError
): d is PreDeployment {
  return d.state === DeploymentState.NEW;
}

export function isDeployment(
  d: Deployment | PreDeployment | DeploymentRecordError
): d is Deployment {
  return d.state === DeploymentState.DEPLOYED;
}
