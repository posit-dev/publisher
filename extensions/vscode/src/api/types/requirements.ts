// Copyright (C) 2023 by Posit Software, PBC.

export type PythonRequirementsResponse = {
  requirements: string[];
};

export type RRequirement = {
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

export type GetRRequirementsResponse = {
  r: RVersionConfig;
  packages: Record<string, RRequirement>;
};
