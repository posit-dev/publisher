// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import {
  GetRPackagesResponse,
  PythonPackagesResponse,
} from "../types/packages";

export class Packages {
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
  getPythonPackages(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<PythonPackagesResponse>(
      `/configurations/${encodedName}/packages/python`,
    );
  }

  // Returns:
  // 200 - success
  // 404 - configuration or requirements file not found
  // 409 - conflict (R is not configured)
  // 422 - package file is invalid
  // 500 - internal server error
  getRPackages(configName: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<GetRPackagesResponse>(
      `/configurations/${encodedName}/packages/r`,
    );
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  createPythonRequirementsFile(python?: string, saveName?: string) {
    return this.client.post<void>("packages/python/scan", { python, saveName });
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  createRRequirementsFile(saveName?: string) {
    return this.client.post<void>("packages/r/scan", { saveName });
  }
}
