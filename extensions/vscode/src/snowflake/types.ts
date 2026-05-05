// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Represents a Snowflake connection parsed from connections.toml or config.toml.
 * Field names use snake_case to match the TOML file format.
 */
export interface SnowflakeConnectionConfig {
  account: string;
  user: string;
  authenticator: string;
  private_key_file?: string;
  private_key_path?: string;
  token?: string;
  role?: string;
}

/** A validated Snowflake connection that successfully authenticated to a Connect server. */
export interface SnowflakeConnection {
  name: string;
  serverUrl: string;
}
