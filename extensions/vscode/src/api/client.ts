// Copyright (C) 2023 by Posit Software, PBC.

import axios from "axios";

import { Credentials } from "./resources/Credentials";
import { Deployments } from "./resources/Deployments";
import { Configurations } from "./resources/Configurations";
import { Files } from "./resources/Files";
import { Requirements } from "./resources/Requirements";

class PublishingClientApi {
  private client;

  configurations: Configurations;
  credentials: Credentials;
  deployments: Deployments;
  files: Files;
  requirements: Requirements;
  apiServiceIsUp: Promise<boolean>;

  constructor(apiBaseUrl: string, apiServiceIsUp: Promise<boolean>) {
    this.client = axios.create({
      baseURL: apiBaseUrl,
    });
    this.apiServiceIsUp = apiServiceIsUp;

    this.configurations = new Configurations(this.client);
    this.credentials = new Credentials(this.client);
    this.deployments = new Deployments(this.client);
    this.files = new Files(this.client);
    this.requirements = new Requirements(this.client);
  }

  setBaseUrl(url: string) {
    this.client.defaults.baseURL = url;
  }
}

let api: PublishingClientApi | undefined = undefined;

// NOTE: this function must be called ahead of useApi()
// so that the class is properly instantiated.
export const initApi = (
  apiServiceIsUp: Promise<boolean>,
  apiBaseUrl: string = "/api",
) => {
  api = new PublishingClientApi(apiBaseUrl, apiServiceIsUp);
};

// NOTE: initApi(...) must be called ahead of the first time
// this method is called, otherwise, you are skipping initialization
// and it will throw an exception
export const useApi = async () => {
  if (!api) {
    throw new Error("client::useApi() must be called AFTER client::initApi()");
  }
  // wait until the service providing the API is available and ready
  await api.apiServiceIsUp;

  return api;
};
