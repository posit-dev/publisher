// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from "src/api/types/error";
import { Configuration } from "src/api/types/configurations";
import { SchemaURL } from "src/api/types/schema";
import { ServerType } from "src/api/types/accounts";

export enum DeploymentState {
  NEW = "new",
  DEPLOYED = "deployed",
  ERROR = "error",
}

export type DeploymentLocation = {
  deploymentName: string;
  deploymentPath: string;
};

export type DeploymentError = {
  error: AgentError;
  state: DeploymentState.ERROR;
} & DeploymentLocation;

type DeploymentRecord = {
  $schema: SchemaURL;
  serverType: ServerType;
  serverUrl: string;
  saveName: string;
  createdAt: string;
} & DeploymentLocation;

export type PreDeployment = {
  state: DeploymentState.NEW;
  error: AgentError | null;
} & DeploymentRecord;

export type Deployment = {
  id: string;
  bundleId: string;
  bundleUrl: string;
  dashboardUrl: string;
  directUrl: string;
  files: string[];
  deployedAt: string;
  state: DeploymentState.DEPLOYED;
  deploymentError: AgentError | null;
} & DeploymentRecord &
  Configuration;

export function isSuccessful(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): boolean | undefined {
  if (d === undefined) {
    return undefined;
  }
  if (isDeployment(d)) {
    return Boolean(!d.deploymentError);
  }
  return Boolean(!d.error);
}

export function isUnsuccessful(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): boolean | undefined {
  const result = isSuccessful(d);
  if (result === undefined) {
    return undefined;
  }
  return !result;
}

export function isDeploymentError(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): d is DeploymentError {
  return Boolean(d && d.state === DeploymentState.ERROR);
}

export function isPreDeployment(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): d is PreDeployment {
  return Boolean(d && d.state === DeploymentState.NEW);
}

export function isSuccessfulPreDeployment(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): d is PreDeployment {
  if (isPreDeployment(d)) {
    const success = isSuccessful(d);
    if (success !== undefined) {
      return success;
    }
  }
  return false;
}

export function isUnsuccessfulPreDeployment(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): d is PreDeployment {
  if (isPreDeployment(d)) {
    const failure = isUnsuccessful(d);
    if (failure !== undefined) {
      return failure;
    }
  }
  return false;
}

export function isDeployment(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): d is Deployment {
  return Boolean(d && d.state === DeploymentState.DEPLOYED);
}

export function isSuccessfulDeployment(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): d is Deployment {
  if (isDeployment(d)) {
    const success = isSuccessful(d);
    if (success !== undefined) {
      return success;
    }
  }
  return false;
}

export function isUnsuccessfulDeployment(
  d: Deployment | PreDeployment | DeploymentError | undefined,
): d is Deployment {
  if (isDeployment(d)) {
    const failure = isUnsuccessful(d);
    if (failure !== undefined) {
      return failure;
    }
  }
  return false;
}
