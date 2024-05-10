// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { Credential } from "../types/credentials";

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
  create(name: string, url: string, apiKey: string) {
    return this.client.post<Credential>(`credentials`, {
      name,
      url,
      apiKey,
    });
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
}
