// Copyright (C) 2023 by Posit Software, PBC.

export type GetDeploymentsResponse = Record<string, Deployment>;

export type DeploymentPythonConfiguration = {
  'package-file': string,
  'package-manager': string,
  version: string
}

export type DeploymentConfiguration = {
  entrypoint: string,
  python: DeploymentPythonConfiguration
}

export type Deployment = {
  configuration: DeploymentConfiguration,
  'configuration-name': string,
  files: string[],
  id: string,
  'server-type': string,
  'server-url': string,
}
