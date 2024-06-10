// Copyright (C) 2024 by Posit Software, PBC.

import { Configuration, ContentRecord, PreContentRecord } from "../api";

export const calculateTitle = (
  contentRecord: ContentRecord | PreContentRecord,
  config?: Configuration,
): {
  title: string;
  problem: boolean;
} => {
  let title = config?.configuration.title;
  if (title) {
    return {
      title,
      problem: false,
    };
  }
  // No title... determine what info we can provide
  if (!contentRecord.configurationName) {
    return {
      title: `Unknown Title Due To Missing Config Entry in ${contentRecord.saveName}`,
      problem: true,
    };
  }
  if (!config) {
    // if we had a contentRecord configuration name,  but do not have a config object,
    // then the config file is missing.
    return {
      title: `Unknown Title Due to Missing Config ${contentRecord.configurationName}`,
      problem: true,
    };
  }
  let configName = config.configurationName;
  if (!configName) {
    // we're guaranteed to have a value because of the check above
    configName = contentRecord.configurationName;
  }
  if (configName) {
    title = `No Title (in ${configName})`;
  } else {
    title = `No Title available`;
  }
  return {
    title,
    problem: true,
  };
};
