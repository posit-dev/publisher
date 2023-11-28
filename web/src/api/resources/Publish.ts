// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

export class Publish {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  start() {
    return this.client.post('/publish', {});
  }
}
