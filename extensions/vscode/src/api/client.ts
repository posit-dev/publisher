// Copyright (C) 2025 by Posit Software, PBC.

import axios from "axios";

import * as Entities from "entities";

class PublishingClientApi {
  private client;

  apiServiceIsUp: Promise<boolean>;

  constructor(apiBaseUrl: string, apiServiceIsUp: Promise<boolean>) {
    this.client = axios.create({
      baseURL: apiBaseUrl,
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Decode data returned for 500 errors when the payload is readable text.
        if (
          error.response?.status === 500 &&
          typeof error.response?.data === "string"
        ) {
          error.response.data = Entities.decodeHTML(error.response.data);
        }
        return Promise.reject(error);
      },
    );
    this.apiServiceIsUp = apiServiceIsUp;
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
