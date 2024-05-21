// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import {
  GetRRequirementsResponse,
  PythonRequirementsResponse,
} from "../types/requirements";

export class Requirements {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 404 - configuration or requirements file not found
  // 409 - conflict (Python is not configured)
  // 422 - package file is invalid
  // 500 - internal server error
  getPythonRequirements(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<PythonRequirementsResponse>(
      `/configurations/${encodedName}/requirements`,
    );
  }

  // Returns:
  // 200 - success
  // 404 - configuration or requirements file not found
  // 409 - conflict (R is not configured)
  // 422 - package file is invalid
  // 500 - internal server error
  getRRequirements(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<GetRRequirementsResponse>(
      `/configurations/${encodedName}/packages`,
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  create(saveName: string | undefined) {
    return this.client.post<void>("packages/python/scan", { saveName });
  }
}
