// Copyright (C) 2023 by Posit Software, PBC.

import axios from 'axios';

import { Accounts } from 'src/api/resources/Accounts';
import { Files } from 'src/api/resources/Files';
import { Publish } from 'src/api/resources/Publish';

class PublishingClientApi {
  accounts: Accounts;
  files: Files;
  publish: Publish;

  constructor() {
    const client = axios.create({
      baseURL: '/api',
      withCredentials: true,
    });

    this.accounts = new Accounts(client);
    this.files = new Files(client);
    this.publish = new Publish(client);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
