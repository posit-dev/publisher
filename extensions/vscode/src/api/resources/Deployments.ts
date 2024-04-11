// Copyright (C) 2023 by Posit Software, PBC.

import { AxiosInstance } from "axios";

import { PreDeployment, AllDeploymentTypes } from "../types/deployments";

export class Deployments {
  private client: AxiosInstance;
  private apiServiceIsUp: Promise<boolean>;

  constructor(client: AxiosInstance, apiServiceIsUp: Promise<boolean>) {
    this.client = client;
    this.apiServiceIsUp = apiServiceIsUp;
  }

  // Returns:
  // 200 - success
  // 500 - internal server error
  async getAll() {
    await this.apiServiceIsUp;
    return this.client.get<Array<AllDeploymentTypes>>("/deployments");
  }

  // Returns:
  // 200 - success
  // 404 - not found
  // 500 - internal server error
  async get(id: string) {
    await this.apiServiceIsUp;
    const encodedId = encodeURIComponent(id);
    return this.client.get<AllDeploymentTypes>(`deployments/${encodedId}`);
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 409 - conflict
  // 500 - internal server error
  // Errors returned through event stream
  async createNew(
    accountName?: string,
    configName?: string,
    saveName?: string,
  ) {
    await this.apiServiceIsUp;
    const params = {
      account: accountName,
      config: configName,
      saveName,
    };
    return this.client.post<PreDeployment>("/deployments", params);
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
}
