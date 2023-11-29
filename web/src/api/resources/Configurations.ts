// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Configuration, ConfigurationError } from 'src/api/types/configurations';

export class Configurations {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  getAll() {
    return this.client.get<Array<Configuration | ConfigurationError>>(
      '/configurations',
    );
  }
}
