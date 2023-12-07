// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { DeploymentFile } from 'src/api/types/files';

export class Files {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  get() {
    return this.client.get<DeploymentFile>('/files');
  }
}
