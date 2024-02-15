// Copyright (C) 2023 by Posit Software, PBC.

import axios, { AxiosResponse } from 'axios';
// import camelcaseKeys from 'camelcase-keys';

import { Accounts } from './resources/Accounts';
import { Deployments } from './resources/Deployments';
import { Configurations } from './resources/Configurations';
import { Files } from './resources/Files';

// const camelCaseInterceptor = (response: AxiosResponse): AxiosResponse => {
//   if (response.data && response.headers['content-type'] === 'application/json') {
//     response.data = camelcaseKeys(
//       response.data,
//       { stopPaths: response.config.ignoreCamelCase, deep: true }
//     );
//   }
//   return response;
// };

class PublishingClientApi {
  accounts: Accounts;
  configurations: Configurations;
  deployments: Deployments;
  files: Files;

  constructor() {
    const client = axios.create({
      // TODO: pass in the API URL, and make it possible to change
      // (in case the agent is restarted on a different port)
      baseURL: 'http://localhost:9001/api',
    });

    // client.interceptors.response.use(camelCaseInterceptor);

    this.accounts = new Accounts(client);
    this.configurations = new Configurations(client);
    this.deployments = new Deployments(client);
    this.files = new Files(client);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
