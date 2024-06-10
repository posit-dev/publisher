// Copyright (C) 2024 by Posit Software, PBC.

import { InputBoxValidationSeverity } from "vscode";

import { useApi } from "src/api";
import { isValidFilename } from "src/utils/files";

export async function untitledConfigurationName(): Promise<string> {
  const api = await useApi();
  const existingConfigurations = (await api.configurations.getAll()).data;

  if (existingConfigurations.length === 0) {
    return "configuration-1";
  }

  let id = 0;
  let defaultName = "";
  do {
    id += 1;
    const trialName = `configuration-${id}`;

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

export function untitledContentRecordName(
  existingContentRecordNames: string[],
): string {
  if (existingContentRecordNames.length === 0) {
    return "deployment-1";
  }

  let id = 0;
  let defaultName = "";
  do {
    id += 1;
    const trialName = `deployment-${id}`;

    if (uniqueContentRecordName(trialName, existingContentRecordNames)) {
      defaultName = trialName;
    }
  } while (!defaultName);
  return defaultName;
}

export function uniqueContentRecordName(
  nameToTest: string,
  existingNames: string[],
) {
  return !existingNames.find((existingName) => {
    return existingName.toLowerCase() === nameToTest.toLowerCase();
  });
}

export function contentRecordNameValidator(
  contentRecordNames: string[],
  currentName: string,
) {
  return async (value: string) => {
    const isUnique =
      value === currentName ||
      uniqueContentRecordName(value, contentRecordNames);

    if (value.length < 3 || !isUnique || !isValidFilename(value)) {
      return {
        message: `Invalid Name: Value must be unique across other deployment record names for this project, be longer than 3 characters, cannot be '.' or contain '..' or any of these characters: /:*?"<>|\\`,
        severity: InputBoxValidationSeverity.Error,
      };
    }
    return undefined;
  };
}
