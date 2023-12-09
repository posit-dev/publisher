// Copyright (C) 2023 by Posit Software, PBC.

import axios from 'axios';

import { Accounts } from 'src/api/resources/Accounts';
import { Deployments } from 'src/api/resources/Deployments';
import { Configurations } from 'src/api/resources/Configurations';
import { Files } from 'src/api/resources/Files';

class PublishingClientApi {
  accounts: Accounts;
  configurations: Configurations;
  deployments: Deployments;
  files: Files;

  constructor() {
    const client = axios.create({
      baseURL: './api',
      withCredentials: true,
    });

    this.accounts = new Accounts(client);
    this.configurations = new Configurations(client);
    this.deployments = new Deployments(client);
    this.files = new Files(client);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
