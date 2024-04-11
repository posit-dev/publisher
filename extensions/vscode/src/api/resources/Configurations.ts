// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
} from "../types/configurations";

export class Configurations {
  private client: AxiosInstance;
  private apiServiceIsUp: Promise<boolean>;

  constructor(client: AxiosInstance, apiServiceIsUp: Promise<boolean>) {
    this.client = client;
    this.apiServiceIsUp = apiServiceIsUp;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  async getAll() {
    await this.apiServiceIsUp;
    return this.client.get<Array<Configuration | ConfigurationError>>(
      "/configurations",
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  async createOrUpdate(configName: string, cfg: ConfigurationDetails) {
    await this.apiServiceIsUp;
    const encodedName = encodeURIComponent(configName);
    return this.client.put<Configuration>(`configurations/${encodedName}`, cfg);
  }

  // Returns:
  // 204 - success (no response)
  // 404 - not found
  // 500 - internal server error
  async delete(configName: string) {
    await this.apiServiceIsUp;
    const encodedName = encodeURIComponent(configName);
    return this.client.delete(`configurations/${encodedName}`);
  }

  // Inspect the project, returning all possible (detected) configurations
  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  async inspect() {
    await this.apiServiceIsUp;
    return this.client.post<ConfigurationDetails[]>("/inspect");
  }
}
