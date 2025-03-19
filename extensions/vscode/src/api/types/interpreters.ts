// Copyright (C) 2025 by Posit Software, PBC.

import { PythonConfig, RConfig } from "./configurations";

export type InterpreterDefaults = {
  python: PythonConfig;
  preferredPythonPath: string;
  r: RConfig;
  preferredRPath: string;
};
