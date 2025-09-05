// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { Integration, ServerSettings } from "../types/configurations";

export class ConnectServer {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - accepted
  // 500 - internal server error
  getIntegrations(accountName: string) {
    return this.client.get<Integration[]>(
      `accounts/${accountName}/integrations`,
    );
  }

  // Returns:
  // 200 - accepted
  // 500 - internal server error
  getServerSettings(accountName: string) {
    return this.client.get<ServerSettings>(`accounts/${accountName}/server-settings`);
  }
}
