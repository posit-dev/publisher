// Copyright (C) 2025 by Posit Software, PBC.

import { development } from "./development";
import { production } from "./production";
import { staging } from "./staging";

export enum env {
  DEV = "development",
  STAGING = "staging",
  PROD = "production",
}

type Config = {
  cloudURL: string;
  connectCloudURL: string;
  env: env;
};

let config: Config;

if (process.env.CONNECT_CLOUD_ENV === env.STAGING) {
  config = { ...staging, env: env.STAGING };
} else if (process.env.CONNECT_CLOUD_ENV === env.DEV) {
  config = { ...development, env: env.DEV };
} else {
  config = { ...production, env: env.PROD };
}

export default config;
