// Copyright (C) 2024 by Posit Software, PBC.

import { AxiosInstance, AxiosResponse } from "axios";

import { Configuration } from "../types/configurations";
import { PostSecretBody, SecretAction } from "../types/secrets";

export class Secrets {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 404 - not found
  // 500 - internal server error
  get(configName: string, dir: string) {
    const encodedName = encodeURIComponent(configName);
    return this.client.get<string[]>(`/configurations/${encodedName}/secrets`, {
      params: { dir },
    });
  }

  add(configName: string, secretName: string, dir: string) {
    return this.update(configName, SecretAction.ADD, secretName, dir);
  }

  remove(configName: string, secretName: string, dir: string) {
    return this.update(configName, SecretAction.REMOVE, secretName, dir);
  }

  // Returns:
  // 200 - success
  // 400 - bad request
  // 404 - not found
  // 500 - internal server error
  update(
    configName: string,
    action: SecretAction,
    secretName: string,
    dir: string,
  ) {
    const encodedName = encodeURIComponent(configName);
    const body = {
      action,
      secret: secretName,
    };
    return this.client.post<
      Configuration,
      AxiosResponse<Configuration>,
      PostSecretBody
    >(`/configurations/${encodedName}/secrets`, body, { params: { dir } });
  }
}
