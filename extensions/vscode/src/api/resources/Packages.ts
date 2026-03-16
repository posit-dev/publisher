// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { ScanPythonPackagesResponse } from "../types/packages";
import type { PositronSettings } from "../types/positron";
import { PythonExecutable, RExecutable } from "../../types/shared";

export class Packages {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  createPythonRequirementsFile(
    dir: string,
    python: PythonExecutable | undefined,
    saveName?: string,
  ) {
    return this.client.post<ScanPythonPackagesResponse>(
      "packages/python/scan",
      {
        saveName,
      },
      {
        params: {
          dir,
          python: python !== undefined ? python.pythonPath : undefined,
        },
      },
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  createRRequirementsFile(
    dir: string,
    r: RExecutable | undefined,
    saveName?: string,
    positron?: PositronSettings,
  ) {
    return this.client.post<void>(
      "packages/r/scan",
      {
        saveName,
        positron,
      },
      {
        params: {
          dir,
          r: r !== undefined ? r.rPath : "",
        },
      },
    );
  }
}
