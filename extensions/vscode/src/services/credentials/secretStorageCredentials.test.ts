// Copyright (C) 2025 by Posit Software, PBC.

import { describe, test, expect, beforeEach, vi } from "vitest";
import type { SecretStorage, Event } from "vscode";

import { SecretStorageCredentialsService } from "./secretStorageCredentials";
import { ServerType } from "../../api/types/contentRecords";
import {
  NotFoundError,
  IdentityCollisionError,
  NameCollisionError,
  IncompleteCredentialError,
} from "./errors";
import { CREDENTIAL_GUIDS_KEY, CREDENTIAL_KEY_PREFIX } from "./types";

/**
 * Creates a mock SecretStorage for testing.
 */
function createMockSecretStorage(): SecretStorage {
  const storage = new Map<string, string>();

  return {
    get: vi.fn((key: string) => Promise.resolve(storage.get(key))),
    store: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
    keys: vi.fn(() => Promise.resolve([...storage.keys()])),
    onDidChange: vi.fn(() => ({ dispose: vi.fn() })) as unknown as Event<{
      key: string;
    }>,
  };
}

describe("SecretStorageCredentialsService", () => {
  let mockSecrets: SecretStorage;
  let service: SecretStorageCredentialsService;

  beforeEach(() => {
    mockSecrets = createMockSecretStorage();
    service = new SecretStorageCredentialsService(mockSecrets);
  });

  describe("isSupported", () => {
    test("returns true when storage is accessible", async () => {
      const supported = await service.isSupported();
      expect(supported).toBe(true);
    });

    test("returns false when storage throws", async () => {
      const failingSecrets: SecretStorage = {
        get: vi.fn(() => Promise.reject(new Error("Storage unavailable"))),
        store: vi.fn(),
        delete: vi.fn(),
        keys: vi.fn(() => Promise.resolve([])),
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })) as unknown as Event<{
          key: string;
        }>,
      };
      const failingService = new SecretStorageCredentialsService(
        failingSecrets,
      );

      const supported = await failingService.isSupported();
      expect(supported).toBe(false);
    });
  });

  describe("list", () => {
    test("returns empty array when no credentials exist", async () => {
      const credentials = await service.list();
      expect(credentials).toEqual([]);
    });

    test("returns all credentials", async () => {
      // Create two credentials
      await service.set({
        name: "cred1",
        url: "https://connect1.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key1",
      });
      await service.set({
        name: "cred2",
        url: "https://connect2.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key2",
      });

      const credentials = await service.list();
      expect(credentials).toHaveLength(2);
      expect(credentials.map((c) => c.name).sort()).toEqual(["cred1", "cred2"]);
    });
  });

  describe("set", () => {
    test("creates a Connect credential with API key", async () => {
      const cred = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "abc123",
      });

      expect(cred.name).toBe("my-server");
      expect(cred.url).toBe("https://connect.example.com/");
      expect(cred.serverType).toBe(ServerType.CONNECT);
      expect(cred.apiKey).toBe("abc123");
      expect(cred.guid).toMatch(/^[0-9a-f-]{36}$/);
    });

    test("creates a Connect credential with token auth", async () => {
      const cred = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        token: "token123",
        privateKey: "privatekey123",
      });

      expect(cred.name).toBe("my-server");
      expect(cred.token).toBe("token123");
      expect(cred.privateKey).toBe("privatekey123");
    });

    test("creates a Snowflake credential", async () => {
      const cred = await service.set({
        name: "my-snowflake",
        url: "https://app.snowflakecomputing.app",
        serverType: ServerType.SNOWFLAKE,
        snowflakeConnection: "connection-string",
      });

      expect(cred.serverType).toBe(ServerType.SNOWFLAKE);
      expect(cred.snowflakeConnection).toBe("connection-string");
    });

    test("creates a Connect Cloud credential", async () => {
      const cred = await service.set({
        name: "my-cloud",
        url: "https://connect.posit.cloud",
        serverType: ServerType.CONNECT_CLOUD,
        accountId: "account123",
        accountName: "myaccount",
        refreshToken: "refresh123",
        accessToken: "access123",
        cloudEnvironment: "production",
      });

      expect(cred.serverType).toBe(ServerType.CONNECT_CLOUD);
      expect(cred.accountId).toBe("account123");
      expect(cred.accountName).toBe("myaccount");
    });

    test("normalizes URL with trailing slash", async () => {
      const cred = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      expect(cred.url).toBe("https://connect.example.com/");
    });

    test("adds https scheme if missing", async () => {
      const cred = await service.set({
        name: "my-server",
        url: "connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      expect(cred.url).toBe("https://connect.example.com/");
    });

    test("throws NameCollisionError when name already exists", async () => {
      await service.set({
        name: "my-server",
        url: "https://connect1.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key1",
      });

      await expect(
        service.set({
          name: "my-server",
          url: "https://connect2.example.com",
          serverType: ServerType.CONNECT,
          apiKey: "key2",
        }),
      ).rejects.toThrow(NameCollisionError);
    });

    test("throws IdentityCollisionError when URL already exists", async () => {
      await service.set({
        name: "server1",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key1",
      });

      await expect(
        service.set({
          name: "server2",
          url: "https://connect.example.com",
          serverType: ServerType.CONNECT,
          apiKey: "key2",
        }),
      ).rejects.toThrow(IdentityCollisionError);
    });

    test("throws IncompleteCredentialError when missing required fields", async () => {
      await expect(
        service.set({
          name: "",
          url: "https://connect.example.com",
          serverType: ServerType.CONNECT,
          apiKey: "key",
        }),
      ).rejects.toThrow(IncompleteCredentialError);

      await expect(
        service.set({
          name: "server",
          url: "",
          serverType: ServerType.CONNECT,
          apiKey: "key",
        }),
      ).rejects.toThrow(IncompleteCredentialError);

      await expect(
        service.set({
          name: "server",
          url: "https://connect.example.com",
          serverType: ServerType.CONNECT,
          // Missing apiKey and token auth
        }),
      ).rejects.toThrow(IncompleteCredentialError);
    });

    test("preserves provided GUID", async () => {
      const customGuid = "11111111-1111-1111-1111-111111111111";
      const cred = await service.set({
        guid: customGuid,
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      expect(cred.guid).toBe(customGuid);
    });

    test("stores credential in secret storage", async () => {
      const cred = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      // Verify store was called with the credential
      expect(mockSecrets.store).toHaveBeenCalledWith(
        CREDENTIAL_KEY_PREFIX + cred.guid,
        expect.any(String),
      );

      // Verify GUID list was updated
      expect(mockSecrets.store).toHaveBeenCalledWith(
        CREDENTIAL_GUIDS_KEY,
        expect.any(String),
      );
    });
  });

  describe("forceSet", () => {
    test("allows updating existing credential by name", async () => {
      const original = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key1",
      });

      // ForceSet should update the existing credential
      const updated = await service.forceSet({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key2",
      });

      // Should use the same GUID as the original
      expect(updated.guid).toBe(original.guid);
      expect(updated.apiKey).toBe("key2");

      const credentials = await service.list();
      expect(credentials).toHaveLength(1);
    });
  });

  describe("get", () => {
    test("returns credential by GUID", async () => {
      const created = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      const retrieved = await service.get(created.guid);
      expect(retrieved.name).toBe("my-server");
      expect(retrieved.guid).toBe(created.guid);
    });

    test("throws NotFoundError when GUID does not exist", async () => {
      await expect(service.get("nonexistent-guid")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("delete", () => {
    test("removes credential by GUID", async () => {
      const created = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      await service.delete(created.guid);

      // Verify delete was called on storage
      expect(mockSecrets.delete).toHaveBeenCalledWith(
        CREDENTIAL_KEY_PREFIX + created.guid,
      );

      const credentials = await service.list();
      expect(credentials).toHaveLength(0);
    });

    test("throws NotFoundError when GUID does not exist", async () => {
      await expect(service.delete("nonexistent-guid")).rejects.toThrow(
        NotFoundError,
      );
    });

    test("updates GUID list after delete", async () => {
      const cred1 = await service.set({
        name: "server1",
        url: "https://connect1.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key1",
      });
      await service.set({
        name: "server2",
        url: "https://connect2.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key2",
      });

      await service.delete(cred1.guid);

      const credentials = await service.list();
      expect(credentials).toHaveLength(1);
      expect(credentials[0]?.name).toBe("server2");
    });
  });

  describe("reset", () => {
    test("clears all credentials and returns empty string", async () => {
      await service.set({
        name: "server1",
        url: "https://connect1.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key1",
      });
      await service.set({
        name: "server2",
        url: "https://connect2.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key2",
      });

      const backupPath = await service.reset();

      // No backup possible for encrypted storage
      expect(backupPath).toBe("");

      // Verify GUID list was deleted
      expect(mockSecrets.delete).toHaveBeenCalledWith(CREDENTIAL_GUIDS_KEY);

      // Verify credentials are cleared
      const credentials = await service.list();
      expect(credentials).toHaveLength(0);
    });
  });

  describe("Connect Cloud collision detection", () => {
    test("throws IdentityCollisionError for same accountId and cloudEnvironment", async () => {
      await service.set({
        name: "cloud1",
        url: "https://connect.posit.cloud",
        serverType: ServerType.CONNECT_CLOUD,
        accountId: "account123",
        accountName: "account1",
        refreshToken: "refresh1",
        accessToken: "access1",
        cloudEnvironment: "production",
      });

      // Same accountId and cloudEnvironment should collide
      await expect(
        service.set({
          name: "cloud2",
          url: "https://connect.posit.cloud",
          serverType: ServerType.CONNECT_CLOUD,
          accountId: "account123",
          accountName: "account2",
          refreshToken: "refresh2",
          accessToken: "access2",
          cloudEnvironment: "production",
        }),
      ).rejects.toThrow(IdentityCollisionError);
    });

    test("allows different accountId with same cloudEnvironment", async () => {
      await service.set({
        name: "cloud1",
        url: "https://connect.posit.cloud",
        serverType: ServerType.CONNECT_CLOUD,
        accountId: "account123",
        accountName: "account1",
        refreshToken: "refresh1",
        accessToken: "access1",
        cloudEnvironment: "production",
      });

      // Different accountId should be allowed
      const cred = await service.set({
        name: "cloud2",
        url: "https://connect.posit.cloud",
        serverType: ServerType.CONNECT_CLOUD,
        accountId: "account456",
        accountName: "account2",
        refreshToken: "refresh2",
        accessToken: "access2",
        cloudEnvironment: "production",
      });

      expect(cred.name).toBe("cloud2");
    });
  });

  describe("storage format", () => {
    test("stores credentials as JSON with version", async () => {
      const cred = await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      // Get the raw stored data
      const storedData = await mockSecrets.get(
        CREDENTIAL_KEY_PREFIX + cred.guid,
      );
      expect(storedData).toBeDefined();

      const parsed = JSON.parse(storedData!);
      expect(parsed.version).toBe(3);
      expect(parsed.guid).toBe(cred.guid);
      expect(parsed.data.name).toBe("my-server");
    });
  });
});
