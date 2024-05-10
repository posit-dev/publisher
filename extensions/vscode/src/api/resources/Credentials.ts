// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { Credential } from "../types/credentials";

export class Credentials {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 201 - accepted
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  createOrUpdate(cred: Credential) {
    return this.client.post(`credentials`, cred);
  }

  // Returns:
  // 204 - no content
  // 400 - bad request
  // 404 - not found
  // 500 - internal server error
  delete(name: string) {
    return this.client.delete(`credentials`, {
      params: {
        name,
      },
    });
  }
}
