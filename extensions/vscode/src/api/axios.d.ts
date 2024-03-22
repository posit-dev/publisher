// Copyright (C) 2023 by Posit Software, PBC.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AxiosRequestConfig } from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    ignoreCamelCase?: string[];
  }
}
