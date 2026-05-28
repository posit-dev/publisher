// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { GUID } from "@posit-dev/connect-api";

import { credentialFactory } from "src/test/unit-test-utils/factories";
import { mockSecretStorage } from "src/test/unit-test-utils/vscode-mocks";
import { ServerType } from "src/api/types/contentRecords";
import { listConnections } from "src/snowflake/connections";
import type { SnowflakeConnectionConfig } from "src/snowflake/types";
import { storeCredential } from "./storage";
import {
  CredentialsService,
  CreateCredentialInput,
  connectAPIOptionsFromCredential,
} from "./service";
import {
  CredentialNotFoundError,
  CredentialNameCollisionError,
  CredentialIdentityCollisionError,
  IncompleteCredentialError,
} from "./errors";

vi.mock("vscode");
vi.mock("src/logging");
vi.mock("src/snowflake/connections");
vi.mock("snowflake-sdk");

import snowflake from "snowflake-sdk";

vi.mock("src/config", () => ({
  default: {
    connectCloudURL: "https://connect.posit.cloud",
  },
}));

vi.mock("src/constants", () => ({
  CONNECT_CLOUD_ENV: "production",
}));

describe("CredentialsService", () => {
  let secrets: mockSecretStorage;
  let service: CredentialsService;

  beforeEach(() => {
    secrets = new mockSecretStorage();
    service = new CredentialsService(secrets);
  });

  describe("list", () => {
    test("returns all credentials from storage", async () => {
      const creds = credentialFactory.buildList(2);
      for (const c of creds) {
        await storeCredential(secrets, c);
      }

      const result = await service.list();
      expect(result).toEqual(creds);
    });

    test("returns empty array when no credentials exist", async () => {
      const result = await service.list();
      expect(result).toEqual([]);
    });
  });

  describe("get", () => {
    test("returns credential by GUID", async () => {
      const creds = credentialFactory.buildList(2);
      for (const c of creds) {
        await storeCredential(secrets, c);
      }

      const result = await service.get(creds[0]!.guid);
      expect(result).toEqual(creds[0]);
    });

    test("throws CredentialNotFoundError for missing GUID", async () => {
      await expect(service.get(GUID("nonexistent"))).rejects.toThrow(
        CredentialNotFoundError,
      );
    });
  });

  describe("create", () => {
    test("creates a Connect credential with API key", async () => {
      const input: CreateCredentialInput = {
        name: "My Connect",
        url: "https://connect.example.com/",
        serverType: ServerType.CONNECT,
        apiKey: "test-api-key",
      };

      const result = await service.create(input);

      expect(result.name).toBe("My Connect");
      expect(result.url).toBe("https://connect.example.com");
      expect(result.apiKey).toBe("test-api-key");
      expect(result.serverType).toBe(ServerType.CONNECT);
      expect(result.guid).toBeTruthy();
      expect(result.cloudEnvironment).toBe("");

      // Verify it was persisted
      const all = await service.list();
      expect(all).toHaveLength(1);
    });

    test("creates a Connect credential with token auth", async () => {
      const input: CreateCredentialInput = {
        name: "My Connect Token",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        token: "test-token",
        privateKey: "test-private-key",
      };

      const result = await service.create(input);

      expect(result.token).toBe("test-token");
      expect(result.privateKey).toBe("test-private-key");
      expect(result.apiKey).toBe("");
    });

    test("creates a Snowflake credential with API key", async () => {
      const input: CreateCredentialInput = {
        name: "My Snowflake",
        url: "https://my-org.snowflakecomputing.app",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "my-connection",
        apiKey: "connect-api-key",
      };

      const result = await service.create(input);

      expect(result.snowflakeConnection).toBe("my-connection");
      expect(result.apiKey).toBe("connect-api-key");
      expect(result.serverType).toBe(ServerType.SNOWFLAKE);
    });

    test("creates a Snowflake credential with token auth", async () => {
      const input: CreateCredentialInput = {
        name: "My Snowflake Token",
        url: "https://my-org.snowflakecomputing.app",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "my-connection",
        token: "connect-token-id",
        privateKey: "connect-private-key",
      };

      const result = await service.create(input);

      expect(result.snowflakeConnection).toBe("my-connection");
      expect(result.token).toBe("connect-token-id");
      expect(result.privateKey).toBe("connect-private-key");
      expect(result.serverType).toBe(ServerType.SNOWFLAKE);
    });

    test("throws IncompleteCredentialError when Snowflake has no Connect auth", async () => {
      const input: CreateCredentialInput = {
        name: "Bad Snowflake",
        url: "https://my-org.snowflakecomputing.app",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "my-connection",
      };

      await expect(service.create(input)).rejects.toThrow(
        IncompleteCredentialError,
      );
    });

    test("throws IncompleteCredentialError when Snowflake has both apiKey and token", async () => {
      const input: CreateCredentialInput = {
        name: "Bad Snowflake",
        url: "https://my-org.snowflakecomputing.app",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "my-connection",
        apiKey: "key",
        token: "tok",
        privateKey: "pk",
      };

      await expect(service.create(input)).rejects.toThrow(
        IncompleteCredentialError,
      );
    });

    test("creates a Connect Cloud credential", async () => {
      const input: CreateCredentialInput = {
        name: "My Cloud",
        serverType: ServerType.CONNECT_CLOUD,
        accountId: "acct-123",
        accountName: "my-account",
        refreshToken: "refresh-tok",
        accessToken: "access-tok",
      };

      const result = await service.create(input);

      expect(result.accountId).toBe("acct-123");
      expect(result.cloudEnvironment).toBe("production");
      expect(result.url).toBe("https://connect.posit.cloud");
      expect(result.serverType).toBe(ServerType.CONNECT_CLOUD);
    });

    test("normalizes the URL", async () => {
      const input: CreateCredentialInput = {
        name: "Normalized",
        url: "https://connect.example.com/path/",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      };

      const result = await service.create(input);
      expect(result.url).toBe("https://connect.example.com/path");
    });

    test("throws CredentialNameCollisionError on duplicate name", async () => {
      const existing = credentialFactory.build({ name: "Duplicate" });
      await storeCredential(secrets, existing);

      const input: CreateCredentialInput = {
        name: "Duplicate",
        url: "https://other.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      };

      await expect(service.create(input)).rejects.toThrow(
        CredentialNameCollisionError,
      );
    });

    test("throws CredentialIdentityCollisionError on duplicate URL for Connect", async () => {
      const existing = credentialFactory.build({
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
      });
      await storeCredential(secrets, existing);

      const input: CreateCredentialInput = {
        name: "Different Name",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      };

      await expect(service.create(input)).rejects.toThrow(
        CredentialIdentityCollisionError,
      );
    });

    test("throws CredentialIdentityCollisionError on duplicate AccountID+CloudEnvironment", async () => {
      const existing = credentialFactory.build({
        serverType: ServerType.CONNECT_CLOUD,
        accountId: "acct-123",
        cloudEnvironment: "production",
      });
      await storeCredential(secrets, existing);

      const input: CreateCredentialInput = {
        name: "Different Name",
        serverType: ServerType.CONNECT_CLOUD,
        accountId: "acct-123",
        accountName: "other-name",
        refreshToken: "tok",
        accessToken: "tok",
      };

      await expect(service.create(input)).rejects.toThrow(
        CredentialIdentityCollisionError,
      );
    });

    test("throws IncompleteCredentialError when Connect has both apiKey and token", async () => {
      const input: CreateCredentialInput = {
        name: "Bad",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
        token: "tok",
        privateKey: "pk",
      };

      await expect(service.create(input)).rejects.toThrow(
        IncompleteCredentialError,
      );
    });

    test("throws IncompleteCredentialError when Connect has neither apiKey nor token", async () => {
      const input: CreateCredentialInput = {
        name: "Bad",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
      };

      await expect(service.create(input)).rejects.toThrow(
        IncompleteCredentialError,
      );
    });

    test("throws IncompleteCredentialError when name is empty", async () => {
      const input: CreateCredentialInput = {
        name: "",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      };

      await expect(service.create(input)).rejects.toThrow(
        IncompleteCredentialError,
      );
    });
  });

  describe("delete", () => {
    test("removes credential by GUID", async () => {
      const creds = credentialFactory.buildList(2);
      for (const c of creds) {
        await storeCredential(secrets, c);
      }

      await service.delete(creds[0]!.guid);

      const remaining = await service.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.guid).toBe(creds[1]!.guid);
    });

    test("throws CredentialNotFoundError for missing GUID", async () => {
      await expect(service.delete(GUID("nonexistent"))).rejects.toThrow(
        CredentialNotFoundError,
      );
    });
  });

  describe("reset", () => {
    test("clears all credentials", async () => {
      const creds = credentialFactory.buildList(3);
      for (const c of creds) {
        await storeCredential(secrets, c);
      }

      await service.reset();

      const result = await service.list();
      expect(result).toEqual([]);
    });
  });
});

describe("connectAPIOptionsFromCredential", () => {
  let service: CredentialsService;

  beforeEach(() => {
    const secrets = new mockSecretStorage();
    service = new CredentialsService(secrets);
  });

  describe("API key auth", () => {
    test("returns apiKey options when apiKey is present", async () => {
      const result = await connectAPIOptionsFromCredential(service, {
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
    test("returns token options when token and privateKey are present", async () => {
      const result = await connectAPIOptionsFromCredential(service, {
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

    test("prefers token auth over API key auth when both are present", async () => {
      const result = await connectAPIOptionsFromCredential(service, {
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
    test("returns url-only options when no auth fields are set", async () => {
      const result = await connectAPIOptionsFromCredential(service, {
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
    test("spreads extra options onto the result", async () => {
      const result = await connectAPIOptionsFromCredential(
        service,
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

      vi.spyOn(service, "getSnowflakeToken").mockImplementation((config) => {
        if (config.authenticator === "unsupported") {
          return Promise.reject(
            new Error('unsupported authenticator type: "unsupported"'),
          );
        }
        return Promise.resolve("sf-test-token-123");
      });
    });

    test("returns snowflakeToken + apiKey options for Snowflake credentials with API key", async () => {
      const result = await connectAPIOptionsFromCredential(service, {
        url: "https://my-org.snowflakecomputing.app",
        apiKey: "connect-api-key",
        token: "",
        privateKey: "",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "default",
      });

      expect(result).toMatchObject({
        url: "https://my-org.snowflakecomputing.app",
        snowflakeToken: "sf-test-token-123",
        apiKey: "connect-api-key",
      });
    });

    test("returns snowflakeToken + token+privateKey options for Snowflake credentials with token auth", async () => {
      const result = await connectAPIOptionsFromCredential(service, {
        url: "https://my-org.snowflakecomputing.app",
        apiKey: "",
        token: "connect-token-id",
        privateKey: "connect-private-key",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "default",
      });

      expect(result).toMatchObject({
        url: "https://my-org.snowflakecomputing.app",
        snowflakeToken: "sf-test-token-123",
        token: "connect-token-id",
        privateKey: "connect-private-key",
      });
    });

    test("returns snowflakeToken-only for legacy Snowflake credentials with no Connect auth", async () => {
      const result = await connectAPIOptionsFromCredential(service, {
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
      expect(result).not.toHaveProperty("token");
    });

    test("passes extra options through for Snowflake credentials", async () => {
      const result = await connectAPIOptionsFromCredential(
        service,
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

    test("throws when Snowflake connection name is not found", async () => {
      await expect(
        connectAPIOptionsFromCredential(service, {
          url: "https://my-org.snowflakecomputing.app",
          apiKey: "",
          token: "",
          privateKey: "",
          serverType: ServerType.SNOWFLAKE,
          snowflakeConnection: "nonexistent",
        }),
      ).rejects.toThrow("nonexistent");
    });

    test("throws when token provider creation fails", async () => {
      await expect(
        connectAPIOptionsFromCredential(service, {
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

describe("CredentialsService cache invalidation", () => {
  let service: CredentialsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CredentialsService(new mockSecretStorage());
  });

  const testConnection = {
    account: "myaccount",
    user: "myuser",
    authenticator: "externalbrowser",
  };

  const setupMockConnection = (isValid: boolean, tokenValue = "test-token") => {
    const mockConnectAsync = vi.fn().mockResolvedValue(undefined);
    const mockSerialize = vi.fn().mockReturnValue(
      JSON.stringify({
        services: { sf: { tokenInfo: { sessionToken: tokenValue } } },
      }),
    );
    const mockIsValidAsync = vi.fn().mockResolvedValue(isValid);
    const mockDestroy = vi.fn((callback: (err?: Error) => void) => {
      callback();
    });

    vi.mocked(snowflake.createConnection).mockReturnValue({
      connectAsync: mockConnectAsync,
      serialize: mockSerialize,
      isValidAsync: mockIsValidAsync,
      destroy: mockDestroy,
    } as unknown as ReturnType<typeof snowflake.createConnection>);

    return { mockConnectAsync, mockSerialize, mockIsValidAsync, mockDestroy };
  };

  describe("cache hit with valid connection", () => {
    it("returns cached connection without destroying it", async () => {
      const { mockDestroy } = setupMockConnection(true);

      // First call creates and caches the connection
      await service.getSnowflakeToken(testConnection);

      // Second call should return cached version
      await service.getSnowflakeToken(testConnection);

      // Connection should never be destroyed
      expect(mockDestroy).not.toHaveBeenCalled();
      // createConnection should only be called once (for the first call)
      expect(snowflake.createConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe("cache hit with invalid connection", () => {
    it("destroys invalid cached connection and creates a new one", async () => {
      const { mockIsValidAsync, mockDestroy } = setupMockConnection(true);

      // First call creates and caches the connection
      await service.getSnowflakeToken(testConnection);

      // Make the cached connection invalid for the next call
      mockIsValidAsync.mockResolvedValue(false);

      // Second call should detect invalid connection
      await service.getSnowflakeToken(testConnection);

      // Connection should be destroyed
      expect(mockDestroy).toHaveBeenCalledOnce();
      // createConnection should be called twice (first and replacement)
      expect(snowflake.createConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache key computation", () => {
    it("uses account:user:authenticator as cache key", async () => {
      setupMockConnection(true, "token1");

      // First connection
      await service.getSnowflakeToken({
        account: "acct1",
        user: "user1",
        authenticator: "externalbrowser",
      });

      // Different account - should create new connection
      await service.getSnowflakeToken({
        account: "acct2",
        user: "user1",
        authenticator: "externalbrowser",
      });

      expect(snowflake.createConnection).toHaveBeenCalledTimes(2);
    });

    it("treats different authenticators as different cache keys", async () => {
      setupMockConnection(true);

      // JWT auth
      await service.getSnowflakeToken({
        account: "acct1",
        user: "user1",
        authenticator: "snowflake_jwt",
        private_key_file: "/path/to/key.p8",
      });

      // OAuth auth - different authenticator
      await service.getSnowflakeToken({
        account: "acct1",
        user: "user1",
        authenticator: "oauth",
        token: "oauth-token",
      });

      expect(snowflake.createConnection).toHaveBeenCalledTimes(2);
    });

    it("treats different users as different cache keys", async () => {
      setupMockConnection(true);

      // User 1
      await service.getSnowflakeToken({
        account: "acct1",
        user: "user1",
        authenticator: "externalbrowser",
      });

      // User 2 - different user
      await service.getSnowflakeToken({
        account: "acct1",
        user: "user2",
        authenticator: "externalbrowser",
      });

      expect(snowflake.createConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe("concurrent cache access", () => {
    it("handles concurrent calls with the same cache key serially", async () => {
      const { mockConnectAsync } = setupMockConnection(true);

      // Simulate a slow connection
      let connectStarted = 0;
      let connectFinished = 0;
      mockConnectAsync.mockImplementation(async () => {
        connectStarted++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        connectFinished++;
      });

      // Start two concurrent calls
      await Promise.all([
        service.getSnowflakeToken(testConnection),
        service.getSnowflakeToken(testConnection),
      ]);

      // Connection should only be created once (mutex ensures serial access)
      expect(snowflake.createConnection).toHaveBeenCalledTimes(1);
      // connectAsync should only be called once
      expect(connectStarted).toBe(1);
      expect(connectFinished).toBe(1);
    });

    it("allows concurrent calls with different cache keys", async () => {
      let callCount = 0;
      const mockConnectAsync = vi.fn().mockResolvedValue(undefined);
      const mockIsValidAsync = vi.fn().mockResolvedValue(true);
      const mockDestroy = vi.fn((callback: (err?: Error) => void) => {
        callback();
      });

      // Return different tokens for each connection
      const mockSerialize = vi.fn().mockImplementation(() => {
        callCount++;
        return JSON.stringify({
          services: {
            sf: { tokenInfo: { sessionToken: `token-${callCount}` } },
          },
        });
      });

      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnectAsync,
        serialize: mockSerialize,
        isValidAsync: mockIsValidAsync,
        destroy: mockDestroy,
      } as unknown as ReturnType<typeof snowflake.createConnection>);

      const [token1, token2] = await Promise.all([
        service.getSnowflakeToken({
          account: "acct1",
          user: "user1",
          authenticator: "externalbrowser",
        }),
        service.getSnowflakeToken({
          account: "acct2",
          user: "user1",
          authenticator: "externalbrowser",
        }),
      ]);

      // Different keys - different tokens
      expect(token1).not.toBe(token2);
      // createConnection should be called twice
      expect(snowflake.createConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe("destroy error handling", () => {
    it("logs destroy error but still removes from cache", async () => {
      const mockConnectAsync = vi.fn().mockResolvedValue(undefined);
      const mockSerialize = vi.fn().mockReturnValue(
        JSON.stringify({
          services: { sf: { tokenInfo: { sessionToken: "token" } } },
        }),
      );
      const mockIsValidAsync = vi.fn().mockResolvedValue(false);
      const mockDestroy = vi
        .fn()
        .mockImplementation((callback: (err?: Error) => void) =>
          callback(new Error("destroy failed")),
        );

      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnectAsync,
        serialize: mockSerialize,
        isValidAsync: mockIsValidAsync,
        destroy: mockDestroy,
      } as unknown as ReturnType<typeof snowflake.createConnection>);

      // First call creates and caches the connection
      await service.getSnowflakeToken(testConnection);

      // Second call attempts to destroy invalid connection
      await service.getSnowflakeToken(testConnection);

      // Connection should still be destroyed (attempt made)
      expect(mockDestroy).toHaveBeenCalledOnce();
      // A new connection should be created despite destroy error
      expect(snowflake.createConnection).toHaveBeenCalledTimes(2);
    });
  });
});

describe("CredentialsService.getSnowflakeToken", () => {
  let service: CredentialsService;

  beforeEach(() => {
    service = new CredentialsService(new mockSecretStorage());
  });

  it("throws for unsupported authenticator type", async () => {
    await expect(
      service.getSnowflakeToken({
        account: "myaccount",
        user: "myuser",
        authenticator: "unsupported",
      }),
    ).rejects.toThrow('unsupported authenticator type: "unsupported"');
  });

  describe("JWT token provider (snowflake_jwt)", () => {
    it("throws when private_key_file is missing", async () => {
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "snowflake_jwt",
        }),
      ).rejects.toThrow("private_key_file is required for snowflake_jwt");
    });

    it("creates connection with correct account, username, authenticator, and privateKeyPath", async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockSerialize = vi.fn().mockReturnValue(
        JSON.stringify({
          services: { sf: { tokenInfo: { sessionToken: "token" } } },
        }),
      );
      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnect,
        serialize: mockSerialize,
      } as unknown as ReturnType<typeof snowflake.createConnection>);

      await service.getSnowflakeToken({
        account: "myaccount",
        user: "myuser",
        authenticator: "snowflake_jwt",
        private_key_file: "/path/to/key.p8",
      });
      expect(snowflake.createConnection).toHaveBeenCalledWith({
        account: "myaccount",
        username: "myuser",
        authenticator: "SNOWFLAKE_JWT",
        privateKeyPath: "/path/to/key.p8",
        clientStoreTemporaryCredential: true,
      });
    });
  });

  describe("OAuth token provider (oauth)", () => {
    it("throws when token is missing", async () => {
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "oauth",
        }),
      ).rejects.toThrow("token is required for oauth");
    });

    it("creates connection with correct account, authenticator, and token", async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockSerialize = vi.fn().mockReturnValue(
        JSON.stringify({
          services: { sf: { tokenInfo: { sessionToken: "token" } } },
        }),
      );
      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnect,
        serialize: mockSerialize,
      } as unknown as ReturnType<typeof snowflake.createConnection>);

      await service.getSnowflakeToken({
        account: "myaccount",
        user: "myuser",
        authenticator: "oauth",
        token: "my-oauth-token",
      });
      expect(snowflake.createConnection).toHaveBeenCalledWith({
        account: "myaccount",
        authenticator: "OAUTH",
        token: "my-oauth-token",
        clientStoreTemporaryCredential: true,
      });
    });
  });

  describe("External browser token provider (externalbrowser)", () => {
    it("creates connection with correct account, username, and authenticator", async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockSerialize = vi.fn().mockReturnValue(
        JSON.stringify({
          services: { sf: { tokenInfo: { sessionToken: "token" } } },
        }),
      );
      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnect,
        serialize: mockSerialize,
      } as unknown as ReturnType<typeof snowflake.createConnection>);

      await service.getSnowflakeToken({
        account: "myaccount",
        user: "myuser",
        authenticator: "externalbrowser",
      });
      expect(snowflake.createConnection).toHaveBeenCalledWith({
        account: "myaccount",
        username: "myuser",
        authenticator: "EXTERNALBROWSER",
        clientStoreTemporaryCredential: true,
      });
    });
  });

  describe("shared token extraction and error handling", () => {
    const testCases: Array<{
      authenticator: string;
      tokenValue: string;
      connectionInput: SnowflakeConnectionConfig;
    }> = [
      {
        authenticator: "snowflake_jwt",
        tokenValue: "mock-jwt-token-123",
        connectionInput: {
          account: "myaccount",
          user: "myuser",
          authenticator: "snowflake_jwt",
          private_key_file: "/path/to/key.p8",
        },
      },
      {
        authenticator: "oauth",
        tokenValue: "mock-oauth-token-456",
        connectionInput: {
          account: "myaccount",
          user: "myuser",
          authenticator: "oauth",
          token: "my-oauth-token",
        },
      },
      {
        authenticator: "externalbrowser",
        tokenValue: "mock-token-abc",
        connectionInput: {
          account: "myaccount",
          user: "myuser",
          authenticator: "externalbrowser",
        },
      },
    ];

    testCases.forEach(({ authenticator, tokenValue, connectionInput }) => {
      describe(`for ${authenticator}`, () => {
        let mockConnectAsync: ReturnType<typeof vi.fn>;
        let mockSerialize: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          mockConnectAsync = vi.fn().mockResolvedValue(undefined);
          mockSerialize = vi.fn().mockReturnValue(
            JSON.stringify({
              services: { sf: { tokenInfo: { sessionToken: tokenValue } } },
            }),
          );
          vi.mocked(snowflake.createConnection).mockReturnValue({
            connectAsync: mockConnectAsync,
            serialize: mockSerialize,
          } as unknown as ReturnType<typeof snowflake.createConnection>);
        });

        it("returns the session token from serialized connection state", async () => {
          const token = await service.getSnowflakeToken(connectionInput);
          expect(token).toBe(tokenValue);
        });

        it("throws if session token is absent from serialized state", async () => {
          mockSerialize.mockReturnValue(JSON.stringify({ services: {} }));
          await expect(
            service.getSnowflakeToken(connectionInput),
          ).rejects.toThrow("missing session token");
        });

        it("throws if connectAsync rejects", async () => {
          mockConnectAsync.mockRejectedValue(
            new Error(`${authenticator} auth failed`),
          );
          await expect(
            service.getSnowflakeToken(connectionInput),
          ).rejects.toThrow(`${authenticator} auth failed`);
        });
      });
    });
  });
});
