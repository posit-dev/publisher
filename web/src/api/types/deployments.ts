// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from 'src/api/types/error';
import { Configuration } from 'src/api/types/configurations';
import { SchemaURL } from 'src/api/types/schema';
import { ServerType } from 'src/api/types/accounts';

export type DeploymentLocation = {
  deploymentName: string;
  deploymentPath: string;
}

export type DeploymentRecordError = {
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

export function isDeploymentRecordError(
  d: Deployment | DeploymentRecordError
): d is DeploymentRecordError {
  return (d as DeploymentRecordError).error !== undefined;
}
