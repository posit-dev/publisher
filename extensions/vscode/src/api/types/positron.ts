// Copyright (C) 2025 by Posit Software, PBC.

export type PositronRSettings = {
  // One of: 'auto' | 'rstudio' | 'posit-ppm' | 'none'
  // Future-proof: allow custom URL string type too
  defaultRepositories: string;
  packageManagerRepository?: string;
};

export type PositronSettings = {
  r?: PositronRSettings;
};
