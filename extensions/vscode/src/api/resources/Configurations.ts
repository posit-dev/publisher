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
  // 500 - internal server error
  async getAll() {
    return this.client.get<Array<Configuration | ConfigurationError>>(
      "/configurations",
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  async createOrUpdate(configName: string, cfg: ConfigurationDetails) {
    const encodedName = encodeURIComponent(configName);
    return this.client.put<Configuration>(`configurations/${encodedName}`, cfg);
  }

  // Returns:
  // 204 - success (no response)
  // 404 - not found
  // 500 - internal server error
  async delete(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.delete(`configurations/${encodedName}`);
  }

  // Inspect the project, returning all possible (detected) configurations
  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  async inspect() {
    return this.client.post<ConfigurationDetails[]>("/inspect");
  }
}
