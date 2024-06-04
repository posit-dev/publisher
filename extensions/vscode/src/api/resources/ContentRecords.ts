// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import {
  PreContentRecord,
  AllContentRecordTypes,
  ContentRecord,
} from "../types/contentRecords";

export class ContentRecords {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  getAll() {
    return this.client.get<Array<AllContentRecordTypes>>("/deployments");
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  get(id: string) {
    const encodedId = encodeURIComponent(id);
    return this.client.get<AllContentRecordTypes>(`deployments/${encodedId}`);
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  // Errors returned through event stream
  createNew(accountName?: string, configName?: string, saveName?: string) {
    const params = {
      account: accountName,
      config: configName,
      saveName,
    };
    return this.client.post<PreContentRecord>("/deployments", params);
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // Errors returned through event stream
  publish(
    targetName: string,
    accountName: string,
    configName: string = "default",
  ) {
    const params = {
      account: accountName,
      config: configName,
    };
    const encodedTarget = encodeURIComponent(targetName);
    return this.client.post<{ localId: string }>(
      `deployments/${encodedTarget}`,
      params,
    );
  }

  // Returns:
  // 204 - no content
  // 404 - not found
  // 500 - internal server error
  delete(saveName: string) {
    const encodedSaveName = encodeURIComponent(saveName);
    return this.client.delete(`deployments/${encodedSaveName}`);
  }

  // Returns:
  // 204 - no content
  // 404 - contentRecord or config file not found
  // 500 - internal server error
  patch(contentRecordName: string, configName: string) {
    const encodedName = encodeURIComponent(contentRecordName);
    return this.client.patch<ContentRecord>(`deployments/${encodedName}`, {
      configurationName: configName,
    });
  }
}
