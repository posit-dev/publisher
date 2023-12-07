// Copyright (C) 2023 by Posit Software, PBC.

import axios from 'axios';

import { Accounts } from 'src/api/resources/Accounts';
import { Deployments } from 'src/api/resources/Deployments';
import { Configurations } from 'src/api/resources/Configurations';

class PublishingClientApi {
  accounts: Accounts;
  configurations: Configurations;
  deployments: Deployments;

  constructor() {
    const client = axios.create({
      baseURL: './api',
      withCredentials: true,
    });

    this.accounts = new Accounts(client);
    this.configurations = new Configurations(client);
    this.deployments = new Deployments(client);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
