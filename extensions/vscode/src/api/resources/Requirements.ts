// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { RequirementsResponse } from "../types/requirements";

export class Requirements {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 404 - no requirements file found
  // 500 - internal server error
  getAll() {
    return this.client.get<RequirementsResponse>("requirements");
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  create(saveName: string | undefined) {
    return this.client.post<void>("requirements", { saveName });
  }
}
