// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Configuration, ConfigurationDetails, ConfigurationError } from '../types/configurations';

export class Configurations {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  getAll() {
    return this.client.get<Array<Configuration | ConfigurationError>>(
      '/configurations',
    );
  }

  // Returns:
  // 200 - success and a Configuration, or fails and returns a ConfigurationError
  // 400 - bad request
  // 500 - internal server error
  createNew(name: string, cfg: ConfigurationDetails) {
    const encodedName = encodeURIComponent(name);
    return this.client.post<Configuration | ConfigurationError>(
      `configurations/${encodedName}`,
      cfg
    );
  }

  // Returns:
  // 200 - success and a Configuration, or fails and returns a ConfigurationError
  // 400 - bad request
  // 500 - internal server error
  initialize(name: string) {
    const params = {
      configurationName: name,
    };
    return this.client.post<Configuration | ConfigurationError>(
      '/initialize',
      params
    );
  }

  // Returns:
  // 200 - success and an array of Configurations
  // 400 - bad request
  // 500 - internal server error
  initializeAll() {
    return this.client.post<ConfigurationDetails[]>(
      '/initialize-all',
    );
  }

  // Returns:
  // 204 - success (no response)
  // 404 - not found
  // 500 - internal server error
  delete(name: string) {
    const encodedName = encodeURIComponent(name);
    return this.client.delete<void>(
      `configurations/${encodedName}`,
    );
  }}
