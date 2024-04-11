// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { Account } from "../types/accounts";

export class Accounts {
  private client: AxiosInstance;
  private apiServiceIsUp: Promise<boolean>;

  constructor(client: AxiosInstance, apiServiceIsUp: Promise<boolean>) {
    this.client = client;
    this.apiServiceIsUp = apiServiceIsUp;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  async getAll() {
    await this.apiServiceIsUp;
    return this.client.get<Array<Account>>("/accounts");
  }

  // Returns:
  // 200 - success
  // 404 - account not found
  // 500 - internal server error
  async get(accountName: string) {
    await this.apiServiceIsUp;
    const encodedAccountName = encodeURIComponent(accountName);
    return this.client.get<Account>(`/accounts/${encodedAccountName}`);
  }
}
