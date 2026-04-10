// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerType } from "src/api/types/contentRecords";

vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("src/api", () => ({
  useApi: vi.fn(),
}));

vi.mock("src/config", () => ({
  default: {
    connectCloudURL: "https://connect.posit.cloud",
  },
}));

vi.mock("src/constants", () => ({
  CONNECT_CLOUD_ENV: "production",
}));

vi.mock("src/snowflake/connections");
vi.mock("src/snowflake/tokenProviders");

import { listConnections } from "src/snowflake/connections";
import { createTokenProvider } from "src/snowflake/tokenProviders";
import { connectAPIOptionsFromCredential } from "./service";

describe("connectAPIOptionsFromCredential", () => {
  describe("API key auth", () => {
    it("returns apiKey options when apiKey is present", async () => {
      const result = await connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "my-key",
        token: "",
        privateKey: "",
        serverType: ServerType.CONNECT,
        snowflakeConnection: "",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
        apiKey: "my-key",
      });
    });
  });

  describe("token auth", () => {
    it("returns token options when token and privateKey are present", async () => {
      const result = await connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "",
        token: "my-token",
        privateKey: "my-private-key",
        serverType: ServerType.CONNECT,
        snowflakeConnection: "",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
        token: "my-token",
        privateKey: "my-private-key",
      });
    });

    it("prefers token auth over API key auth when both are present", async () => {
      const result = await connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "my-key",
        token: "my-token",
        privateKey: "my-private-key",
        serverType: ServerType.CONNECT,
        snowflakeConnection: "",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
        token: "my-token",
        privateKey: "my-private-key",
      });
    });
  });

  describe("no auth", () => {
    it("returns url-only options when no auth fields are set", async () => {
      const result = await connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "",
        token: "",
        privateKey: "",
        serverType: ServerType.CONNECT,
        snowflakeConnection: "",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
      });
    });
  });

  describe("extra options", () => {
    it("spreads extra options onto the result", async () => {
      const result = await connectAPIOptionsFromCredential(
        {
          url: "https://connect.example.com",
          apiKey: "my-key",
          token: "",
          privateKey: "",
          serverType: ServerType.CONNECT,
          snowflakeConnection: "",
        },
        { rejectUnauthorized: false, timeout: 5000 },
      );

      expect(result).toEqual({
        url: "https://connect.example.com",
        apiKey: "my-key",
        rejectUnauthorized: false,
        timeout: 5000,
      });
    });
  });

  describe("Snowflake auth", () => {
    beforeEach(() => {
      vi.mocked(listConnections).mockReturnValue({
        default: {
          account: "myaccount",
          user: "myuser",
          authenticator: "snowflake_jwt",
          private_key_file: "/path/to/key.p8",
        },
        "bad-authenticator": {
          account: "myaccount",
          user: "myuser",
          authenticator: "unsupported",
        },
      });

      vi.mocked(createTokenProvider).mockImplementation((config) => {
        if (config.authenticator === "unsupported") {
          throw new Error('unsupported authenticator type: "unsupported"');
        }
        return {
          getToken: vi.fn().mockResolvedValue("sf-test-token-123"),
        };
      });
    });

    it("returns snowflakeToken options for Snowflake credentials", async () => {
      const result = await connectAPIOptionsFromCredential({
        url: "https://my-org.snowflakecomputing.app",
        apiKey: "",
        token: "",
        privateKey: "",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "default",
      });

      expect(result).toMatchObject({
        url: "https://my-org.snowflakecomputing.app",
        snowflakeToken: "sf-test-token-123",
      });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("passes extra options through for Snowflake credentials", async () => {
      const result = await connectAPIOptionsFromCredential(
        {
          url: "https://my-org.snowflakecomputing.app",
          apiKey: "",
          token: "",
          privateKey: "",
          serverType: ServerType.SNOWFLAKE,
          snowflakeConnection: "default",
        },
        { rejectUnauthorized: false },
      );

      expect(result).toMatchObject({
        snowflakeToken: "sf-test-token-123",
        rejectUnauthorized: false,
      });
    });

    it("throws when Snowflake connection name is not found", async () => {
      await expect(
        connectAPIOptionsFromCredential({
          url: "https://my-org.snowflakecomputing.app",
          apiKey: "",
          token: "",
          privateKey: "",
          serverType: ServerType.SNOWFLAKE,
          snowflakeConnection: "nonexistent",
        }),
      ).rejects.toThrow("nonexistent");
    });

    it("throws when token provider creation fails", async () => {
      await expect(
        connectAPIOptionsFromCredential({
          url: "https://my-org.snowflakecomputing.app",
          apiKey: "",
          token: "",
          privateKey: "",
          serverType: ServerType.SNOWFLAKE,
          snowflakeConnection: "bad-authenticator",
        }),
      ).rejects.toThrow("unsupported authenticator type");
    });
  });
});
