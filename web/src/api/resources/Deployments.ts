// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Deployment, DeploymentError } from 'src/api/types/deployments';

export class Deployments {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  getAll() {
    return this.client.get<Array<Deployment | DeploymentError>>(
      '/deployments',
    );
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  get(id: string) {
    const encodedId = encodeURIComponent(id);
    return this.client.get<Deployment | DeploymentError>(
      `deployments/${encodedId}`,
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // Errors returned through event stream
  publishNew(
    accountName? : string,
    saveName?: string,
  ){
    const params = {
      account: accountName,
      config: 'default', // hardcoded for now
      saveName,
    };
    return this.client.post(
      '/deployments',
      params,
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // Errors returned through event stream
  publishUpdate(
    accountName? : string,
    targetName?: string,
  ){
    const params = {
      account: accountName,
      config: 'default', // hardcoded for now
      target: targetName,
    };
    return this.client.post(
      '/deployments',
      params,
    );
  }
}
