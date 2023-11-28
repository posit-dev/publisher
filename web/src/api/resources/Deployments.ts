// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance, AxiosRequestConfig } from 'axios';

import { GetDeploymentsResponse } from 'src/api/types/deployments';

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

  get() {
    return this.client.get<GetDeploymentsResponse>(
      '/deployments',
      this.createConfig()
    );
  }
}
