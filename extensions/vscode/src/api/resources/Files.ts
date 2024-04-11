// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { DeploymentFile } from "../types/files";

export class Files {
  private client: AxiosInstance;
  private apiServiceIsUp: Promise<boolean>;

  constructor(client: AxiosInstance, apiServiceIsUp: Promise<boolean>) {
    this.client = client;
    this.apiServiceIsUp = apiServiceIsUp;
  }

  // Returns:
  // 200 - success
  // 403 - pathname is not safe - forbidden
  // 500 - internal server error
  async get() {
    await this.apiServiceIsUp;
    return this.client.get<DeploymentFile>("/files");
  }
}
