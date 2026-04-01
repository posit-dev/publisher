// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { Credential } from "../types/credentials";
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
