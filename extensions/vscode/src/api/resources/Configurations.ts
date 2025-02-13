// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
  ConfigurationInspectionResult,
} from "../types/configurations";
import { PythonExecutable, RExecutable } from "../../types/shared";

export class Configurations {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  get(configName: string, dir: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<Configuration | ConfigurationError>(
      `/configurations/${encodedName}`,
      {
        params: { dir },
      },
    );
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  getAll(dir: string, params?: { entrypoint?: string; recursive?: boolean }) {
    return this.client.get<Array<Configuration | ConfigurationError>>(
      "/configurations",
      {
        params: {
          dir,
          ...params,
        },
      },
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  createOrUpdate(configName: string, cfg: ConfigurationDetails, dir: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.put<Configuration>(
      `configurations/${encodedName}`,
      cfg,
      {
        params: {
          dir,
        },
      },
    );
  }

  // Returns:
  // 204 - success (no response)
  // 404 - not found
  // 500 - internal server error
  delete(configName: string, dir: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.delete(`configurations/${encodedName}`, {
      params: { dir },
    });
  }

  // Inspect the project, returning all possible (detected) configurations
  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  inspect(
    dir: string,
    python: PythonExecutable | undefined,
    r: RExecutable | undefined,
    params?: { entrypoint?: string; recursive?: boolean },
  ) {
    return this.client.post<ConfigurationInspectionResult[]>(
      "/inspect",
      {},
      {
        params: {
          dir,
          python: python !== undefined ? python.pythonPath : undefined,
          r: r !== undefined ? r.rPath : "",
          ...params,
        },
      },
    );
  }
}
