// Copyright (C) 2024 by Posit Software, PBC.

import { InputBoxValidationSeverity } from "vscode";

import { isValidFilename } from "src/utils/files";
import filenamify from "filenamify";

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
  return (value: string) => {
    const isUnique =
      value === currentName ||
      uniqueContentRecordName(value, contentRecordNames);

    if (value.length < 3 || !isUnique || !isValidFilename(value)) {
      return {
        message: `Error: Invalid Name: Value must be unique across other deployment record names for this project, be longer than 3 characters, cannot be all spaces, '.' or contain '..' or any of these characters: /:*?"<>|\\`,
        severity: InputBoxValidationSeverity.Error,
      };
    }
    return undefined;
  };
}

/**
 * Creates a semi-unique configuration name from a content title.
 *
 * @param title The title of the content to create a filename from
 * @param existingNames [[]] An array of existing configuration names to ensure
 *   uniqueness
 * @returns A filename that is safe to use in the filesystem with a unique 4
 * character ending to avoid Git conflicts.
 */
export function newConfigFileNameFromTitle(
  title: string,
  existingNames: string[] = [],
): string {
  const filename = filenamify(title, {
    replacement: "-",
    maxLength: 95,
  });

  // Generate unique name endings until we find a unique one
  let result;
  do {
    const uniqueEnding = randomNameEnding(4);
    result = `${filename}-${uniqueEnding}`;
  } while (existingNames.includes(result));

  return result;
}

/**
 * Generates a random, uppercase, base 32 string of the given length.
 *
 * @param length [4] The length of the resulting string
 * @returns A random base 32 string of the given length
 */
export function randomNameEnding(length: number = 4): string {
  return Array.from({ length: length }, () =>
    Math.floor(Math.random() * 32)
      .toString(32)
      .toUpperCase(),
  ).join("");
}
