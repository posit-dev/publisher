// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { GetDeploymentsResponse } from 'src/api/types/deployments';

export class Deployments {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  get() {
    return this.client.get<GetDeploymentsResponse>(
      '/deployments',
    );
  }
}
