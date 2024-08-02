// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { EntryPointPath } from "../types/entrypoints";

export class EntryPoints {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Inspect the project, returning all possible (detected) entrypoints
  // based on file extensions. Will be recursive downward from dir parameter
  // Returns:
  // 200 - success
  // 500 - internal server error
  get(dir: string) {
    return this.client.post<EntryPointPath[]>("/entrypoints", {
      params: {
        dir,
      },
    });
  }
}
