// Copyright (C) 2023 by Posit Software, PBC.

import axios from 'axios';

import { Accounts } from 'src/api/resources/Accounts';
import { Files } from 'src/api/resources/Files';

class PublishingClientApi {
  accounts: Accounts;
  files: Files;

  constructor() {
    const client = axios.create({
      baseURL: '/api',
      withCredentials: true,
    });

    this.accounts = new Accounts(client);
    this.files = new Files(client);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
