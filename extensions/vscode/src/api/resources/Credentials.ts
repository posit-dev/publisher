// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { Credential, TestResult } from "../types/credentials";
import { ServerType } from "../types/contentRecords";
import { CONNECT_CLOUD_ENV_HEADER } from "../../constants";

export class Credentials {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - accepted
  // 500 - internal server error
  list() {
    return this.client.get<Credential[]>(`credentials`);
  }

  // Returns:
  // 201 - accepted
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  create(
    name: string,
    url: string,
    apiKey: string,
    snowflakeConnection: string,
    accountId: string,
    accountName: string,
    refreshToken: string,
    accessToken: string,
    serverType: ServerType,
  ) {
    return this.client.post<Credential>(
      `credentials`,
      {
        name,
        url,
        apiKey,
        snowflakeConnection,
        accountId,
        accountName,
        refreshToken,
        accessToken,
        serverType,
      },
      { headers: CONNECT_CLOUD_ENV_HEADER },
    );
  }

  // Returns:
  // 200 - accepted
  // 404 - not found
  // 500 - internal server error
  get(guid: string) {
    return this.client.get<Credential>(`credentials/${guid}`);
  }

  // Returns:
  // 204 - no content
  // 404 - not found
  // 500 - internal server error
  delete(guid: string) {
    return this.client.delete(`credentials/${guid}`);
  }

  // Returns:
  // 204 - success (no response)
  // 500 - internal server error cannot backup file
  // 503 - credentials service unavailable
  reset() {
    return this.client.delete<{ backupFile: string }>(`credentials`);
  }

  // Returns:
  // 200 - with possible results in TestResult object
  // for URL only: no user or error in TestResult
  // for URL and valid API key: user and error === null
  // for invalid URL only: no user, error in TestResult
  //   indicating you need to check the server URL or key
  // for valid URL and invalid API key: no user, error in TestResult
  //   indicating that the API key is invalid
  // 404 - Agent not found...
  test(url: string, insecure: boolean, apiKey?: string) {
    return this.client.post<TestResult>(`test-credentials`, {
      url,
      apiKey,
      insecure,
    });
  }
}
