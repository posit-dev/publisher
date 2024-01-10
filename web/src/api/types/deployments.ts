// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from 'src/api/types/error';
import { Configuration } from 'src/api/types/configurations';
import { SchemaURL } from 'src/api/types/schema';
import { ServerType } from 'src/api/types/accounts';

export type DeploymentLocation = {
  deploymentName: string;
  deploymentPath: string;
}

export type DeploymentError = {
  error: AgentError,
} & DeploymentLocation

export type Deployment = {
  $schema: SchemaURL,
  serverType: ServerType,
  serverUrl: string,
  id: string,
  files: string[],
  deployedAt: string,
  saveName: string,
} & DeploymentLocation & Configuration;

export function isDeploymentError(
  d: Deployment | DeploymentError
): d is DeploymentError {
  return (d as DeploymentError).error !== undefined;
}

export function isPreDeployment(
  d: Deployment | DeploymentError
): boolean {
  return !isDeploymentError(d) && (d as Deployment).id === '';
}
