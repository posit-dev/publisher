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
}
