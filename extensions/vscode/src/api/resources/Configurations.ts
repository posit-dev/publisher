// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { ConfigurationInspectionResult } from "../types/configurations";
import { PythonExecutable, RExecutable } from "../../types/shared";

export class Configurations {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Inspect the project, returning all possible (detected) configurations
  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  inspect(
    dir: string,
    python?: PythonExecutable,
    r?: RExecutable,
    params?: { entrypoint?: string; recursive?: boolean },
  ) {
    return this.client.post<ConfigurationInspectionResult[]>(
      "/inspect",
      {},
      {
        params: {
          dir,
          python: python?.pythonPath,
          r: r?.rPath,
          ...params,
        },
      },
    );
  }
}
