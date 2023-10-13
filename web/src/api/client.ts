// Copyright (C) 2023 by Posit Software, PBC.

import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import camelcaseKeys from 'camelcase-keys';
import decamelizeKeys from 'decamelize-keys';

import { Accounts } from 'src/api/resources/Accounts';
import { Deployment } from 'src/api/resources/Deployment';
import { Files } from 'src/api/resources/Files';
import { Publish } from 'src/api/resources/Publish';

const camelCaseInterceptor = (response: AxiosResponse): AxiosResponse => {
  if (response.data && response.headers['content-type'] === 'application/json') {
    response.data = camelcaseKeys(
      response.data,
      { stopPaths: response.config.ignoreCamelCase, deep: true }
    );
  }
  return response;
};

const snakeCaseInterceptor = (config: InternalAxiosRequestConfig) => {
  if (config.data) {
    config.data = decamelizeKeys(config.data, { deep: true });
  }
  return config;
};

class PublishingClientApi {
  accounts: Accounts;
  deployment: Deployment;
  files: Files;
  publish: Publish;

  constructor() {
    const client = axios.create({
      baseURL: './api',
      withCredentials: true,
    });

    client.interceptors.request.use(snakeCaseInterceptor);
    client.interceptors.response.use(camelCaseInterceptor);

    this.accounts = new Accounts(client);
    this.deployment = new Deployment(client);
    this.files = new Files(client);
    this.publish = new Publish(client);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
