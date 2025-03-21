// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import {
  GetRPackagesResponse,
  PythonPackagesResponse,
  ScanPythonPackagesResponse,
} from "../types/packages";
import { PythonExecutable, RExecutable } from "../../types/shared";

export class Packages {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 404 - configuration or requirements file not found
  // 409 - conflict (Python is not configured)
  // 422 - package file is invalid
  // 500 - internal server error
  getPythonPackages(configName: string, dir: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<PythonPackagesResponse>(
      `/configurations/${encodedName}/packages/python`,
      { params: { dir } },
    );
  }

  // Returns:
  // 200 - success
  // 404 - configuration or requirements file not found
  // 409 - conflict (R is not configured)
  // 422 - package file is invalid
  // 500 - internal server error
  getRPackages(configName: string, dir: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<GetRPackagesResponse>(
      `/configurations/${encodedName}/packages/r`,
      { params: { dir } },
    );
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
  ) {
    return this.client.post<void>(
      "packages/r/scan",
      {
        saveName,
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
