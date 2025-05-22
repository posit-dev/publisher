// Copyright (C) 2025 by Posit Software, PBC.

import { AxiosInstance } from "axios";
import { SnowflakeConnection } from "../types/snowflakeConnections";

export class SnowflakeConnections {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  // List all valid Snowflake connection names for a given server URL.
  //
  // Returned connections include the validated server URL they were
  // successfully tested against.
  //
  // Returns:
  // 200 - ok
  // 500 - internal server error
  list(serverUrl: string) {
    return this.client.get<SnowflakeConnection[]>(`snowflake-connections`, {
      params: {
        serverUrl,
      },
    });
  }
}
