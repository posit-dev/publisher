// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { Credential, TestResult } from "../types/credentials";
import { CONNECT_CLOUD_ENV_HEADER } from "../../constants";

export class Credentials {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  create(credential: Credential) {
    return this.client.post<Credential>(`credentials`, credential, {
      headers: CONNECT_CLOUD_ENV_HEADER,
    });
  }

  delete(guid: string) {
    return this.client.delete(`credentials/${guid}`);
  }

  reset() {
    return this.client.delete(`credentials`);
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
