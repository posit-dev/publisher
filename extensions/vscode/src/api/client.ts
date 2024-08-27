// Copyright (C) 2023 by Posit Software, PBC.

import axios, { AxiosResponse } from "axios";

import { Credentials } from "./resources/Credentials";
import { ContentRecords } from "./resources/ContentRecords";
import { Configurations } from "./resources/Configurations";
import { Files } from "./resources/Files";
import { Packages } from "./resources/Packages";
import { EntryPoints } from "./resources/Entrypoints";
import * as Entities from "entities";

class PublishingClientApi {
  private client;

  configurations: Configurations;
  credentials: Credentials;
  contentRecords: ContentRecords;
  files: Files;
  packages: Packages;
  apiServiceIsUp: Promise<boolean>;
  entrypoints: EntryPoints;

  constructor(apiBaseUrl: string, apiServiceIsUp: Promise<boolean>) {
    this.client = axios.create({
      baseURL: apiBaseUrl,
    });
    this.client.interceptors.request.use((request) => {
      request.ts = performance.now();
      return request;
    });

    this.client.interceptors.response.use(
      (response) => {
        this.logDuration(response);
        return response;
      },
      (error) => {
        // Decode data returned for 500 errors
        if (error.response.status === 500) {
          error.response.data = Entities.decodeHTML5(error.response.data);
        }
        this.logDuration(error.response);
        return Promise.reject(error);
      },
    );
    this.apiServiceIsUp = apiServiceIsUp;

    this.configurations = new Configurations(this.client);
    this.credentials = new Credentials(this.client);
    this.contentRecords = new ContentRecords(this.client);
    this.files = new Files(this.client);
    this.packages = new Packages(this.client);
    this.entrypoints = new EntryPoints(this.client);
  }

  logDuration(response: AxiosResponse<any, any>) {
    const timestamp = response.config.ts;
    if (timestamp) {
      const request = response.request;
      const duration = Math.round(Number(performance.now() - timestamp));
      console.log(`Request: ${request.path} took ${duration}ms`);
    }
    return response;
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
