// Copyright (C) 2023 by Posit Software, PBC.

import axios from 'axios';

import Accounts from 'src/api/resources/Accounts';

class PublishingClientApi {
  accounts: Accounts;

  constructor() {
    const client = axios.create({
      baseURL: '/api',
      withCredentials: true,
    });

    this.accounts = new Accounts(client);
  }
}

export const api = new PublishingClientApi();

export const useApi = () => api;
