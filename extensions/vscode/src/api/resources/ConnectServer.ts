// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { ServerSettings } from "../types/connect";

export class ConnectServer {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - accepted
  // 500 - internal server error
  getServerSettings(accountName: string, contentType?: string) {
    const params = contentType ? { type: contentType } : undefined;
    return this.client.get<ServerSettings>(
      `accounts/${accountName}/server-settings`,
      { params },
    );
  }
}
