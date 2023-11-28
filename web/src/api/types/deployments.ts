// Copyright (C) 2023 by Posit Software, PBC.

import { Configuration } from 'src/api/types/configurations';
import { SchemaURL } from 'src/api/types/schema';

export type DeploymentError = {
  error: string,
}

export enum ServerType {
  CONNECT = 'connect',
  SHINY_APPS = 'shinyapps',
  CLOUD = 'cloud',
}

export type Deployment = {
  $schema: SchemaURL,
  serverType: ServerType
  serverUrl: string,
  id: string,
  files: string[]
  configurationPath: string
  configurationName: string
  configuration: Configuration
}

export function isDeploymentError(
  d: Deployment | DeploymentError
): d is DeploymentError {
  return (d as DeploymentError).error !== undefined;
}
