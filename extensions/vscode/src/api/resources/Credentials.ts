// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance, AxiosResponse } from "axios";
import { Credential, TestResult } from "../types/credentials";
import { ServerType } from "../types/contentRecords";
import { CONNECT_CLOUD_ENV_HEADER } from "../../constants";
import { StateData } from "../../multiStepInputs/multiStepHelper";
import type { CredentialsService } from "../../services/credentials";

export class Credentials {
  private client: AxiosInstance;
  private nativeServicePromise?: Promise<CredentialsService | undefined>;

  constructor(
    client: AxiosInstance,
    nativeServicePromise?: Promise<CredentialsService | undefined>,
  ) {
    this.client = client;
    this.nativeServicePromise = nativeServicePromise;
  }

  // Returns:
  // 200 - accepted
  // 500 - internal server error
  async list(): Promise<AxiosResponse<Credential[]>> {
    // Try native TypeScript service (file-based storage)
    if (this.nativeServicePromise) {
      const nativeService = await this.nativeServicePromise;
      if (nativeService) {
        const credentials = await nativeService.list();
        // Use native service if it has credentials
        if (credentials.length > 0) {
          return {
            data: credentials,
            status: 200,
            statusText: "OK",
            headers: {},
            config: { headers: {} },
          } as AxiosResponse<Credential[]>;
        }
        // Fall back to Go API if file storage is empty
        // (credentials may be in system keyring)
      }
    }
    return this.client.get<Credential[]>(`credentials`);
  }

  // Returns:
  // 201 - accepted
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  connectCreate(data: Record<string, StateData>, serverType: ServerType) {
    return this.client.post<Credential>(
      `credentials`,
      {
        name: data.name,
        url: data.url,
        apiKey: data.apiKey,
        token: data.token,
        privateKey: data.privateKey,
        snowflakeConnection: data.snowflakeConnection,
        serverType,
        accountId: "",
        accountName: "",
        refreshToken: "",
        accessToken: "",
      },
      { headers: CONNECT_CLOUD_ENV_HEADER },
    );
  }

  // Returns:
  // 201 - accepted
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  connectCloudCreate(data: Record<string, StateData>, serverType: ServerType) {
    return this.client.post<Credential>(
      `credentials`,
      {
        name: data.name,
        accountId: data.accountId,
        accountName: data.accountName,
        refreshToken: data.refreshToken,
        accessToken: data.accessToken,
        serverType,
        url: "",
        apiKey: "",
        snowflakeConnection: "",
        token: "",
        privateKey: "",
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

  // Generates a new token for Connect authentication
  // Returns token ID, claim URL, private key, and discovered server URL
  generateToken(serverUrl: string) {
    return this.client.post<{
      token: string;
      claimUrl: string;
      privateKey: string;
      serverUrl: string;
    }>(`connect/token`, {
      serverUrl,
    });
  }

  // Verifies if a token has been claimed
  // Returns the user information if the token has been claimed
  verifyToken(serverUrl: string, token: string, privateKey: string) {
    return this.client.post<{
      username?: string;
      guid?: string;
      [key: string]: unknown;
    }>(`connect/token/user`, {
      serverUrl,
      token,
      privateKey,
    });
  }
}
