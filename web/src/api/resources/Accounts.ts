// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Account } from 'src/api/types/accounts';

export default class Accounts {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  list() {
    return this.client.get<Account[]>('/accounts');
  }
}
