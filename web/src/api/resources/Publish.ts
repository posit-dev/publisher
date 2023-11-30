// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

export class Publish {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  start(
    accountName : string | undefined = undefined,
    config: string = 'default',
    target: string | undefined = undefined,
  ){
    const params = {
      account: accountName,
      config,
      target,
    };
    return this.client.post(
      '/deployments',
      params,
    );
  }
}
