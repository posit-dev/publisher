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
  getAll(dir: string, params?: { entrypoints?: string; recursive?: boolean }) {
    return this.client.get<Array<AllContentRecordTypes>>("/deployments", {
      params: {
        dir,
        ...params,
      },
    });
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  get(id: string, dir: string) {
    const encodedId = encodeURIComponent(id);
    return this.client.get<AllContentRecordTypes>(`deployments/${encodedId}`, {
      params: {
        dir,
      },
    });
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  // Errors returned through event stream
  createNew(
    dir: string,
    accountName?: string,
    configName?: string,
    saveName?: string,
  ) {
    const data = {
      account: accountName,
      config: configName,
      saveName,
    };
    return this.client.post<PreContentRecord>("/deployments", data, {
      params: { dir },
    });
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // Errors returned through event stream
  publish(
    targetName: string,
    accountName: string,
    configName: string,
    dir: string,
    secrets?: Record<string, string>,
  ) {
    const data = {
      account: accountName,
      config: configName,
      secrets: secrets,
    };
    const encodedTarget = encodeURIComponent(targetName);
    return this.client.post<{ localId: string }>(
      `deployments/${encodedTarget}`,
      data,
      {
        params: {
          dir,
        },
      },
    );
  }

  // Returns:
  // 204 - no content
  // 404 - not found
  // 500 - internal server error
  delete(saveName: string, dir: string) {
    const encodedSaveName = encodeURIComponent(saveName);
    return this.client.delete(`deployments/${encodedSaveName}`, {
      params: { dir },
    });
  }

  // Returns:
  // 204 - no content
  // 404 - contentRecord or config file not found
  // 500 - internal server error
  patch(deploymentName: string, configName: string, dir: string) {
    const encodedName = encodeURIComponent(deploymentName);
    return this.client.patch<ContentRecord>(
      `deployments/${encodedName}`,
      {
        configurationName: configName,
      },
      {
        params: {
          dir,
        },
      },
    );
  }
}
