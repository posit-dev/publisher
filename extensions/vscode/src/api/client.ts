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

    this.accounts = new Accounts(this.client);
    this.configurations = new Configurations(this.client);
    this.deployments = new Deployments(this.client);
    this.files = new Files(this.client);
    this.requirements = new Requirements(this.client);
  }

  setBaseUrl(url: string) {
    this.client.defaults.baseURL = url;
  }
}

let api: PublishingClientApi | undefined = undefined;

// NOTE: The first time this factory function is called, it must be
// called with both of the optional parameters. After the first call,
// any optional parameters passed in are ignored.
// Failure to provide the values on first or incorrectly providing them
// after the first call will result in errors being thrown.
export const useApi = async (
  apiBaseUrl?: string,
  apiServiceIsUp?: Promise<boolean>,
) => {
  if (!api) {
    if (!apiBaseUrl || !apiServiceIsUp) {
      throw new Error("The factory function PublishingClientApi::useApi is missing required parameters on first call.");
    }
    api = new PublishingClientApi(apiBaseUrl, apiServiceIsUp);
  } else {
    if (apiBaseUrl || apiServiceIsUp) {
      throw new Error("The factory function PublishingClientApi::useApi is being called with inappropriate optional parameters. These have already been set within the first call to the factory. ");
    }
  }
  // wait until the service providing the API is available and ready
  await api.apiServiceIsUp;

  return api;
};
