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
  async get() {
    return this.client.get<DeploymentFile>("/files");
  }
}
