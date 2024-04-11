// Copyright (C) 2023 by Posit Software, PBC.

import axios from "axios";

import { Accounts } from "./resources/Accounts";
import { Deployments } from "./resources/Deployments";
import { Configurations } from "./resources/Configurations";
import { Files } from "./resources/Files";
import { Requirements } from "./resources/Requirements";

class PublishingClientApi {
  private client;

  accounts: Accounts;
  configurations: Configurations;
  deployments: Deployments;
  files: Files;
  requirements: Requirements;
  apiServiceIsUp: Promise<boolean>;

  constructor(apiBaseUrl: string, apiServiceIsUp: Promise<boolean>) {
    this.client = axios.create({
      baseURL: apiBaseUrl,
    });
    this.apiServiceIsUp = apiServiceIsUp;

    this.accounts = new Accounts(this.client, this.apiServiceIsUp);
    this.configurations = new Configurations(this.client, this.apiServiceIsUp);
    this.deployments = new Deployments(this.client, this.apiServiceIsUp);
    this.files = new Files(this.client, this.apiServiceIsUp);
    this.requirements = new Requirements(this.client, this.apiServiceIsUp);
  }

  setBaseUrl(url: string) {
    this.client.defaults.baseURL = url;
  }

  setServiceState(p: Promise<boolean>) {
    this.apiServiceIsUp = p;
  }
}

let api: PublishingClientApi | undefined = undefined;

export const useApi = (
  apiBaseUrl?: string,
  apiServiceIsUp?: Promise<boolean>,
) => {
  if (!api) {
    if (!apiServiceIsUp || !apiBaseUrl) {
      throw new Error("PublishingClientApi missing required parameters");
    }
    api = new PublishingClientApi(apiBaseUrl, apiServiceIsUp);
  }
  return api;
};
