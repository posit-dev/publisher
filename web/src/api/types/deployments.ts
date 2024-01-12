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
  state: DeploymentState;
  deploymentName: string;
  deploymentPath: string;
}

export type DeploymentRecordError = {
  error: AgentError,
} & DeploymentLocation

export type PreDeployment = {
  $schema: SchemaURL,
  serverType: ServerType,
  serverUrl: string,
  saveName: string,
} & DeploymentLocation;

export type Deployment = PreDeployment & {
  id: string,
  files: string[],
  deployedAt: string,
  saveName: string,
} & Configuration;

export function isDeploymentRecordError(
  d: Deployment | DeploymentRecordError
): d is DeploymentRecordError {
  return (d as DeploymentRecordError).error !== undefined;
}

export function isPreDeployment(
  d: Deployment | PreDeployment | DeploymentRecordError
): d is PreDeployment {
  return (d as PreDeployment).state === DeploymentState.NEW;
}

export function isDeployment(
  d: Deployment | PreDeployment | DeploymentRecordError
): d is Deployment {
  return (d as Deployment).state === DeploymentState.DEPLOYED;
}
