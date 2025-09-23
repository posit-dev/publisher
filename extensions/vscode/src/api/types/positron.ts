// Copyright (C) 2025 by Posit Software, PBC.

export type RPackageRepository =
  | "auto"
  | "rstudio"
  | "posit-ppm"
  | "none"
  | string;

export type PositronRSettings = {
  // One of: 'auto' | 'rstudio' | 'posit-ppm' | 'none'
  defaultRepositories: RPackageRepository;
  packageManagerRepository?: string;
};

export type PositronSettings = {
  r?: PositronRSettings;
};
