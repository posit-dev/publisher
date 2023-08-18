// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance, AxiosRequestConfig } from 'axios';

import { Deployment as DeploymentState } from 'src/api/types/deployments';

export class Deployment {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  private createConfig(config?: AxiosRequestConfig): AxiosRequestConfig {
    return {
      ignoreCamelCase: ['manifest.files', 'manifest.packages'],
      ...config,
    };
  }

  get() {
    return this.client.get<DeploymentState>(
      '/deployment',
      this.createConfig()
    );
  }

  setFiles(files: string[], config?: AxiosRequestConfig<DeploymentState>) {
    return this.client.put<DeploymentState>(
      '/deployment/files',
      { files: files },
      this.createConfig(config)
    );
  }
}
