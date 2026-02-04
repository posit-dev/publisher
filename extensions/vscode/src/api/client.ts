// Copyright (C) 2025 by Posit Software, PBC.

import axios from "axios";

import { Credentials } from "./resources/Credentials";
import { ContentRecords } from "./resources/ContentRecords";
import { Configurations } from "./resources/Configurations";
import { Files } from "./resources/Files";
import { Interpreters } from "./resources/Interpreters";
import { Packages } from "./resources/Packages";
import { Secrets } from "./resources/Secrets";
import { EntryPoints } from "./resources/Entrypoints";
import { SnowflakeConnections } from "./resources/SnowflakeConnections";
import * as Entities from "entities";
import { ConnectCloud } from "./resources/ConnectCloud";
import { IntegrationRequests } from "./resources/IntegrationRequests";
import { ConnectServer } from "./resources/ConnectServer";
import { OpenConnectContent } from "./resources/OpenConnectContent";

class PublishingClientApi {
  private client;

  configurations: Configurations;
  interpreters: Interpreters;
  credentials: Credentials;
  contentRecords: ContentRecords;
  files: Files;
  packages: Packages;
  secrets: Secrets;
  integrationRequests: IntegrationRequests;
  apiServiceIsUp: Promise<boolean>;
  entrypoints: EntryPoints;
  snowflakeConnections: SnowflakeConnections;
  connectCloud: ConnectCloud;
  connectServer: ConnectServer;
  openConnectContent: OpenConnectContent;

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
          error.response.data = Entities.decodeHTML5(error.response.data);
        }
        return Promise.reject(error);
      },
    );
    this.apiServiceIsUp = apiServiceIsUp;

    this.configurations = new Configurations(this.client);
    this.credentials = new Credentials(this.client);
    this.contentRecords = new ContentRecords(this.client);
    this.files = new Files(this.client);
    this.interpreters = new Interpreters(this.client);
    this.packages = new Packages(this.client);
    this.secrets = new Secrets(this.client);
    this.integrationRequests = new IntegrationRequests(this.client);
    this.entrypoints = new EntryPoints(this.client);
    this.snowflakeConnections = new SnowflakeConnections(this.client);
    this.connectCloud = new ConnectCloud(this.client);
    this.connectServer = new ConnectServer(this.client);
    this.openConnectContent = new OpenConnectContent(this.client);
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
