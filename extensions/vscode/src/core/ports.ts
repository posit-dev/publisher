// Copyright (C) 2025 by Posit Software, PBC.

import {
  Configuration,
  ConfigurationError,
} from "src/api/types/configurations";

export interface ConfigurationStore {
  get(
    configName: string,
    projectDir: string,
  ): Promise<Configuration | ConfigurationError>;
}
