// Copyright (C) 2023 by Posit Software, PBC.

export type PythonPackagesResponse = {
  requirements: string[];
};

export type RPackage = {
  package: string;
  version: string;
  source: string;
  repository: string;
};

export type RRepositoryConfig = {
  name: string;
  url: string;
};

export type RVersionConfig = {
  version: string;
  repositories: RRepositoryConfig[];
};

export type GetRPackagesResponse = {
  r: RVersionConfig;
  packages: Record<string, RPackage>;
};
