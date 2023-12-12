// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Deployment, DeploymentError } from 'src/api/types/deployments';

export class Deployments {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  getAll() {
    return this.client.get<Array<Deployment | DeploymentError>>(
      '/deployments'
    );
  }

  get(id: string) {
    return this.client.get<Deployment | DeploymentError>(
      `deployments/${id}`
    );
  }

  publish(
    accountName? : string,
    target?: string,
    saveName?: string,
  ){
    const params = {
      account: accountName,
      config: 'default', // hardcoded for now
      target,
      saveName,
    };
    return this.client.post(
      '/deployments',
      params,
    );
  }
}
