// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { RequirementsResponse } from "../types/requirements";

export class Requirements {
  private client: AxiosInstance;
  private apiServiceIsUp: Promise<boolean>;

  constructor(client: AxiosInstance, apiServiceIsUp: Promise<boolean>) {
    this.client = client;
    this.apiServiceIsUp = apiServiceIsUp;
  }

  // Returns:
  // 200 - success
  // 404 - no requirements file found
  // 500 - internal server error
  async getAll() {
    await this.apiServiceIsUp;
    return this.client.get<RequirementsResponse>("requirements");
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  async create(saveName: string | undefined) {
    await this.apiServiceIsUp;
    return this.client.post<void>("requirements", { saveName });
  }
}
