// Copyright (C) 2023 by Posit Software, PBC.

export enum DeploymentFileType {
  REGULAR = "REGULAR",
  DIRECTORY = "DIR",
}

export type DeploymentFile = {
  id: string;
  fileType: DeploymentFileType;
  base: string;
  reason: FileMatch | null; // pattern that matched a file, null if no match
  files: DeploymentFile[];
  isDir: boolean;
  isEntrypoint: boolean;
  isFile: boolean;
  modifiedDatetime: string;
  rel: string;
  relDir: string;
  size: number;
  abs: string;
};

export enum FileMatchSource {
  FILE = "file",
  BUILT_IN = "built-in",
}

export type FileMatch = {
  source: FileMatchSource;
  pattern: string;
  fileName: string;
  filePath: string;
  exclude: boolean;
};

export enum FileAction {
  INCLUDE = "include",
  EXCLUDE = "exclude",
}
