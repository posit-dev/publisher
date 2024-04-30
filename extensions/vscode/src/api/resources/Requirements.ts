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
  // 204 - no content (Python is not configured)
  // 404 - configuration or requirements file not found
  // 500 - internal server error
  getByConfiguration(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<RequirementsResponse>(
      `/configurations/${encodedName}/requirements`,
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  create(saveName: string | undefined) {
    return this.client.post<void>("requirements", { saveName });
  }
}
