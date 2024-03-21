// Copyright (C) 2023 by Posit Software, PBC.

export enum DeploymentFileType {
  REGULAR = "REGULAR",
  DIRECTORY = "DIR",
}

export type DeploymentFile = {
  id: string;
  fileType: DeploymentFileType;
  base: string;
  exclusion: ExclusionMatch | null;
  files: DeploymentFile[];
  isDir: boolean;
  isEntrypoint: boolean;
  isFile: boolean;
  modifiedDatetime: string;
  rel: string;
  size: number;
  abs: string;
};

export enum ExclusionMatchSource {
  FILE = "file",
  BUILT_IN = "built-in",
}

export type ExclusionMatch = {
  source: ExclusionMatchSource;
  pattern: string;
  filePath: string;
  line: number;
};
