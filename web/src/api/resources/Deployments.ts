// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Deployment } from 'src/api/types/deployments';

export class Deployments {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  getAll() {
    return this.client.get<Array<Deployment>>(
      '/deployments',
    );
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  get(id: string) {
    return this.client.get<Deployment>(
      `deployments/${id}`,
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // Errors returned through event stream
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
