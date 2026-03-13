// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { IntegrationRequest } from "../types/configurations";

export class IntegrationRequests {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - accepted
  // 500 - internal server error
  list(configName: string, dir: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<IntegrationRequest[]>(
      `configurations/${encodedName}/integration-requests`,
      { params: { dir } },
    );
  }

  // Returns:
  // 201 - accepted
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  add(configName: string, dir: string, request: IntegrationRequest) {
    const encodedName = encodeURIComponent(configName);
    return this.client.post<IntegrationRequest>(
      `configurations/${encodedName}/integration-requests`,
      request,
      { params: { dir } },
    );
  }

  // Returns:
  // 204 - no content
  // 404 - not found
  // 500 - internal server error
  delete(configName: string, dir: string, request: IntegrationRequest) {
    const encodedName = encodeURIComponent(configName);
    return this.client.delete<IntegrationRequest>(
      `configurations/${encodedName}/integration-requests`,
      { data: request, params: { dir } },
    );
  }
}
