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
  // If apiKey is provided, connections will be tested with both the
  // Snowflake token and the Connect API key for SPCS OIDC authentication.
  //
  // Returns:
  // 200 - ok
  // 500 - internal server error
  list(serverUrl: string, apiKey?: string) {
    return this.client.get<SnowflakeConnection[]>(`snowflake-connections`, {
      params: {
        serverUrl,
        apiKey,
      },
    });
  }
}
