// Copyright (C) 2026 by Posit Software, PBC.

import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listConnections } from "./connections";

describe("listConnections", () => {
  let tmpDir: string;
  let originalSnowflakeHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowflake-test-"));
    originalSnowflakeHome = process.env.SNOWFLAKE_HOME;
    process.env.SNOWFLAKE_HOME = tmpDir;
  });

  afterEach(() => {
    if (originalSnowflakeHome === undefined) {
      delete process.env.SNOWFLAKE_HOME;
    } else {
      process.env.SNOWFLAKE_HOME = originalSnowflakeHome;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("connections.toml format", () => {
    it("parses top-level connection sections", () => {
      fs.writeFileSync(
        path.join(tmpDir, "connections.toml"),
        `[default]
account = "myaccount"
user = "myuser"
authenticator = "snowflake_jwt"
private_key_file = "/path/to/key.p8"

[other]
account = "otheraccount"
user = "otheruser"
authenticator = "oauth"
token = "my-oauth-token"
`,
      );

      const conns = listConnections();

      expect(Object.keys(conns)).toHaveLength(2);
      expect(conns["default"]).toEqual({
        account: "myaccount",
        user: "myuser",
        authenticator: "snowflake_jwt",
        private_key_file: "/path/to/key.p8",
      });
      expect(conns["other"]).toEqual({
        account: "otheraccount",
        user: "otheruser",
        authenticator: "oauth",
        token: "my-oauth-token",
      });
    });

    it("normalizes private_key_path to private_key_file", () => {
      fs.writeFileSync(
        path.join(tmpDir, "connections.toml"),
        `[default]
account = "myaccount"
user = "myuser"
authenticator = "snowflake_jwt"
private_key_path = "/path/to/key.p8"
`,
      );

      const conns = listConnections();
      expect(conns["default"]?.private_key_file).toBe("/path/to/key.p8");
    });
  });

  describe("config.toml format", () => {
    it("parses connections nested under [connections] section", () => {
      fs.writeFileSync(
        path.join(tmpDir, "config.toml"),
        `[connections.default]
account = "myaccount"
user = "myuser"
authenticator = "snowflake_jwt"
private_key_file = "/path/to/key.p8"

[connections.other]
account = "otheraccount"
user = "otheruser"
authenticator = "oauth"
token = "my-oauth-token"
`,
      );

      const conns = listConnections();

      expect(Object.keys(conns)).toHaveLength(2);
      expect(conns["default"]?.account).toBe("myaccount");
      expect(conns["other"]?.account).toBe("otheraccount");
    });

    it("connections.toml takes priority over config.toml", () => {
      fs.writeFileSync(
        path.join(tmpDir, "connections.toml"),
        `[fromconnections]
account = "connaccount"
user = "connuser"
authenticator = "snowflake_jwt"
`,
      );
      fs.writeFileSync(
        path.join(tmpDir, "config.toml"),
        `[connections.fromconfig]
account = "configaccount"
user = "configuser"
authenticator = "oauth"
`,
      );

      const conns = listConnections();
      expect(conns["fromconnections"]).toBeDefined();
      expect(conns["fromconfig"]).toBeUndefined();
    });
  });

  describe("environment variable overrides", () => {
    let envOverrides: Record<string, string>;

    beforeEach(() => {
      envOverrides = {};
    });

    afterEach(() => {
      for (const key of Object.keys(envOverrides)) {
        delete process.env[key];
      }
    });

    function setEnv(key: string, value: string) {
      envOverrides[key] = value;
      process.env[key] = value;
    }

    it("overrides connection fields from environment variables", () => {
      fs.writeFileSync(
        path.join(tmpDir, "connections.toml"),
        `[default]
account = "original"
user = "original"
authenticator = "snowflake_jwt"
`,
      );

      setEnv("SNOWFLAKE_CONNECTIONS_DEFAULT_ACCOUNT", "overridden");
      setEnv("SNOWFLAKE_CONNECTIONS_DEFAULT_USER", "newuser");

      const conns = listConnections();
      expect(conns["default"]?.account).toBe("overridden");
      expect(conns["default"]?.user).toBe("newuser");
    });

    it("uses uppercase connection name in env var lookup", () => {
      fs.writeFileSync(
        path.join(tmpDir, "connections.toml"),
        `[my-conn]
account = "original"
user = "user"
authenticator = "snowflake_jwt"
`,
      );

      setEnv("SNOWFLAKE_CONNECTIONS_MY-CONN_ACCOUNT", "overridden");

      const conns = listConnections();
      expect(conns["my-conn"]?.account).toBe("overridden");
    });
  });

  it("returns empty object when no config file found", () => {
    // tmpDir exists but has no TOML files
    const conns = listConnections();
    expect(conns).toEqual({});
  });
});
