// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { GUID } from "@posit-dev/connect-api";

import { credentialFactory } from "src/test/unit-test-utils/factories";
import { mockSecretStorage } from "src/test/unit-test-utils/vscode-mocks";
import { ServerType } from "src/api/types/contentRecords";
import { listConnections } from "src/snowflake/connections";
import { createTokenProvider } from "src/snowflake/tokenProviders";
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

const mockCredentialsApi = {
  create: vi.fn(),
  delete: vi.fn(),
  reset: vi.fn(),
};

vi.mock("src/api", () => ({
  useApi: vi.fn(() =>
    Promise.resolve({
      credentials: mockCredentialsApi,
    }),
  ),
}));

vi.mock("vscode");
vi.mock("src/logging");
vi.mock("src/snowflake/connections");
vi.mock("src/snowflake/tokenProviders");

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
    mockCredentialsApi.create.mockReset();
    mockCredentialsApi.delete.mockReset();
    mockCredentialsApi.reset.mockReset();
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

    test("creates a Snowflake credential", async () => {
      const input: CreateCredentialInput = {
        name: "My Snowflake",
        url: "https://my-org.snowflakecomputing.app",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "my-connection",
      };

      const result = await service.create(input);

      expect(result.snowflakeConnection).toBe("my-connection");
      expect(result.serverType).toBe(ServerType.SNOWFLAKE);
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

  describe("dual-write to Go backend", () => {
    test("create() syncs credential to Go backend", async () => {
      const input: CreateCredentialInput = {
        name: "Sync Test",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key-123",
      };

      const result = await service.create(input);

      expect(mockCredentialsApi.create).toHaveBeenCalledOnce();
      expect(mockCredentialsApi.create).toHaveBeenCalledWith(result);
    });

    test("delete() syncs deletion to Go backend", async () => {
      const cred = credentialFactory.build();
      await storeCredential(secrets, cred);

      await service.delete(cred.guid);

      expect(mockCredentialsApi.delete).toHaveBeenCalledOnce();
      expect(mockCredentialsApi.delete).toHaveBeenCalledWith(cred.guid);
    });

    test("reset() syncs reset to Go backend", async () => {
      await service.reset();

      expect(mockCredentialsApi.reset).toHaveBeenCalledOnce();
    });

    test("create() succeeds even when Go backend fails", async () => {
      mockCredentialsApi.create.mockRejectedValue(new Error("Go unavailable"));

      const input: CreateCredentialInput = {
        name: "Resilient",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key-456",
      };

      const result = await service.create(input);
      expect(result.name).toBe("Resilient");

      // Verify it was still persisted in SecretStorage
      const all = await service.list();
      expect(all).toHaveLength(1);
    });

    test("delete() succeeds even when Go backend fails", async () => {
      mockCredentialsApi.delete.mockRejectedValue(new Error("Go unavailable"));

      const cred = credentialFactory.build();
      await storeCredential(secrets, cred);

      await service.delete(cred.guid);

      const remaining = await service.list();
      expect(remaining).toHaveLength(0);
    });

    test("reset() succeeds even when Go backend fails", async () => {
      mockCredentialsApi.reset.mockRejectedValue(new Error("Go unavailable"));

      const creds = credentialFactory.buildList(2);
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
  describe("API key auth", () => {
    test("returns apiKey options when apiKey is present", async () => {
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
    test("returns token options when token and privateKey are present", async () => {
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

    test("prefers token auth over API key auth when both are present", async () => {
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
    test("returns url-only options when no auth fields are set", async () => {
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
    test("spreads extra options onto the result", async () => {
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

    test("returns snowflakeToken options for Snowflake credentials", async () => {
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

    test("passes extra options through for Snowflake credentials", async () => {
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

    test("throws when Snowflake connection name is not found", async () => {
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

    test("throws when token provider creation fails", async () => {
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
