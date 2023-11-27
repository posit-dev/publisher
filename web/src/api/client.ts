// Copyright (C) 2023 by Posit Software, PBC.

import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import camelcaseKeys from 'camelcase-keys';
import decamelizeKeys from 'decamelize-keys';

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
  constructor() {
    const client = axios.create({
      baseURL: './api',
      withCredentials: true,
    });

    client.interceptors.request.use(snakeCaseInterceptor);
    client.interceptors.response.use(camelCaseInterceptor);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
