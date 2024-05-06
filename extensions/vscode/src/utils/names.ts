// Copyright (C) 2024 by Posit Software, PBC.

import { InputBoxValidationSeverity } from "vscode";

import { useApi } from "@publishing-client/api";
import { isValidFilename } from "src/utils/files";

export async function untitledConfigurationName(): Promise<string> {
  const api = await useApi();
  const existingConfigurations = (await api.configurations.getAll()).data;

  if (existingConfigurations.length === 0) {
    return "default";
  }

  let id = 0;
  let defaultName = "";
  do {
    id += 1;
    const trialName = `Untitled-${id}`;

    if (
      !existingConfigurations.find((config) => {
        return (
          config.configurationName.toLowerCase() === trialName.toLowerCase()
        );
      })
    ) {
      defaultName = trialName;
    }
  } while (!defaultName);
  return defaultName;
}

export function untitledDeploymentName(
  existingDeploymentNames: string[],
): string {
  if (existingDeploymentNames.length === 0) {
    return "deployment-1";
  }

  let id = 0;
  let defaultName = "";
  do {
    id += 1;
    const trialName = `deployment-${id}`;

    if (uniqueDeploymentName(trialName, existingDeploymentNames)) {
      defaultName = trialName;
    }
  } while (!defaultName);
  return defaultName;
}

export function uniqueDeploymentName(
  nameToTest: string,
  existingNames: string[],
) {
  return !existingNames.find((existingName) => {
    return existingName.toLowerCase() === nameToTest.toLowerCase();
  });
}

export function deploymentNameValidator(
  deploymentNames: string[],
  currentName: string,
) {
  return async (value: string) => {
    const isUnique =
      value === currentName || uniqueDeploymentName(value, deploymentNames);

    if (value.length < 3 || !isUnique || !isValidFilename(value)) {
      return {
        message: `Invalid Name: Value must be unique across other deployment names for this project, be longer than 3 characters, cannot be '.' or contain '..' or any of these characters: /:*?"<>|\\`,
        severity: InputBoxValidationSeverity.Error,
      };
    }
    return undefined;
  };
}
