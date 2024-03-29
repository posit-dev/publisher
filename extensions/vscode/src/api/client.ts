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

  constructor() {
    this.client = axios.create({
      baseURL: "/api",
    });

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

export const api = new PublishingClientApi();

export const useApi = () => api;
