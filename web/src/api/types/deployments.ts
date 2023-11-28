// Copyright (C) 2023 by Posit Software, PBC.

export type GetDeploymentsResponse = Record<string, Deployment>;

export type DeploymentPythonConfiguration = {
  packageFile: string,
  packageManager: string,
  version: string
}

export type DeploymentConfiguration = {
  entrypoint: string,
  python: DeploymentPythonConfiguration
}

export type Deployment = {
  configuration: DeploymentConfiguration,
  configurationName: string,
  files: string[],
  id: string,
  serverType: string,
  serverUrl: string,
}
