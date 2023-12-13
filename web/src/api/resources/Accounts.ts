// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Account } from 'src/api/types/accounts';

export class Accounts {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  getAll() {
    return this.client.get<{ accounts: Account[] }>('/accounts');
  }

  get(accountName: string) {
    return this.client.get<Account>(`/accounts/${accountName}`);
  }
}
