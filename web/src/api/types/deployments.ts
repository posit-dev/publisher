// Copyright (C) 2023 by Posit Software, PBC.

import { Configuration } from 'src/api/types/configurations';
import { SchemaURL } from 'src/api/types/schema';
import { ServerType } from 'src/api/types/accounts';

export type DeploymentError = {
  error: string,
}

export type Deployment = {
  $schema: SchemaURL,
  serverType: ServerType
  serverUrl: string,
  id: string,
  files: string[]
} & Configuration;

export function isDeploymentError(
  d: Deployment | DeploymentError
): d is DeploymentError {
  return (d as DeploymentError).error !== undefined;
}
