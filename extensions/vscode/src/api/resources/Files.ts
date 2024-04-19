// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { DeploymentFile } from "../types/files";

export class Files {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 403 - pathname is not safe - forbidden
  // 500 - internal server error
  get() {
    return this.client.get<DeploymentFile>("/files");
  }

  // Returns:
  // 200 - success
  // 404 - configuration does not exist
  // 422 - configuration files list contains invalid patterns
  // 500 - internal server error
  getByConfiguration(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<DeploymentFile>(
      `/configurations/${encodedName}/files`,
    );
  }
}
