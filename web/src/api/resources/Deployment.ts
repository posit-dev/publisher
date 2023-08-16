// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance, AxiosRequestConfig } from 'axios';

import { Deployment as DeploymentState } from 'src/api/types/deployments';

export class Deployment {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  get() {
    return this.client.get<DeploymentState>('/deployment');
  }

  setFiles(files: string[], config?: AxiosRequestConfig<DeploymentState>) {
    return this.client.put<DeploymentState>(
      '/deployment/files',
      { files: files },
      config
    );
  }
}
