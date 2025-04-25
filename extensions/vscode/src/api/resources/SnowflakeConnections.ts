// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { SnowflakeConnection } from "../types/snowflakeConnections";

export class SnowflakeConnections {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // Returns:
  // 200 - accepted
  // 500 - internal server error
  list() {
    return this.client.get<SnowflakeConnection[]>(`snowflake-connections`);
  }
}
