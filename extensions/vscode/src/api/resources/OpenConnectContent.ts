// Copyright (C) 2026 by Posit Software, PBC.

import { AxiosInstance } from "axios";

export type OpenConnectContentResponse = {
  workspacePath: string;
};

// Open remote content fetching it from a Posit Connect server.
export class OpenConnectContent {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Trigger the connect open-content flow and return the prepared workspace path.
  openConnectContent(serverUrl: string, contentGuid: string) {
    return this.client.post<OpenConnectContentResponse>("connect/open-content", {
      serverUrl,
      contentGuid,
    });
  }
}
