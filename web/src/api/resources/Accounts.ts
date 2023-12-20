// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from 'axios';

import { Account } from 'src/api/types/accounts';

export class Accounts {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  getAll() {
    return this.client.get<{ accounts: Account[] }>(
      '/accounts',
    );
  }

  // Returns:
  // 200 - success
  // 404 - account not found
  // 500 - internal server error
  get(accountName: string) {
    const encodedAccountName = encodeURIComponent(accountName);
    return this.client.get<Account>(
      `/accounts/${encodedAccountName}`,
    );
  }
}
