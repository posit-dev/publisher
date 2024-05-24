// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "../types/configurations";

export class Configurations {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  get(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<Configuration | ConfigurationError>(
      `/configurations/${encodedName}`,
    );
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  getAll() {
    return this.client.get<Array<Configuration | ConfigurationError>>(
      "/configurations",
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  createOrUpdate(configName: string, cfg: ConfigurationDetails) {
    const encodedName = encodeURIComponent(configName);
    return this.client.put<Configuration>(`configurations/${encodedName}`, cfg);
  }

  // Returns:
  // 204 - success (no response)
  // 404 - not found
  // 500 - internal server error
  delete(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.delete(`configurations/${encodedName}`);
  }

  // Inspect the project, returning all possible (detected) configurations
  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  inspect(python: string | undefined) {
    return this.client.post<ConfigurationDetails[]>("/inspect", { python });
  }
}
