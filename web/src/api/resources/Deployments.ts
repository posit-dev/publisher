// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance, AxiosRequestConfig } from 'axios';

import { Deployment, DeploymentError } from 'src/api/types/deployments';

export class Deployments {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  private createConfig(config?: AxiosRequestConfig): AxiosRequestConfig {
    return {
      ignoreCamelCase: ['files'],
      ...config,
    };
  }

  getAll() {
    return this.client.get<Array<Deployment | DeploymentError>>(
      '/deployments',
      this.createConfig()
    );
  }

  get(id: string) {
    return this.client.get<Deployment | DeploymentError>(
      `deployments/${id}`,
      this.createConfig()
    );
  }
}
