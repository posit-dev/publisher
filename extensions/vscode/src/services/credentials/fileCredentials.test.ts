// Copyright (C) 2025 by Posit Software, PBC.

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import { FileCredentialsService } from "./fileCredentials";
import { ServerType } from "../../api/types/contentRecords";
import {
  NotFoundError,
  IdentityCollisionError,
  NameCollisionError,
  IncompleteCredentialError,
} from "./errors";

describe("FileCredentialsService", () => {
  let tempDir: string;
  let credentialsPath: string;
  let service: FileCredentialsService;

  beforeEach(async () => {
    // Create a temporary directory for test credentials
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "credentials-test-"));
    credentialsPath = path.join(tempDir, ".connect-credentials");
    service = new FileCredentialsService(credentialsPath);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("setup", () => {
    test("creates credentials file if it does not exist", async () => {
      await service.setup();
      const exists = await fs
        .access(credentialsPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    test("does not overwrite existing file", async () => {
      const content = "[credentials]\n";
      await fs.writeFile(credentialsPath, content);
      await service.setup();
      const readContent = await fs.readFile(credentialsPath, "utf-8");
      expect(readContent).toBe(content);
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
  });

  describe("forceSet", () => {
    test("allows updating existing credential", async () => {
      await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key1",
      });

      // ForceSet should not throw despite name collision
      const updated = await service.forceSet({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key2",
      });

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

      const credentials = await service.list();
      expect(credentials).toHaveLength(0);
    });

    test("throws NotFoundError when GUID does not exist", async () => {
      await expect(service.delete("nonexistent-guid")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("reset", () => {
    test("clears all credentials and returns backup path", async () => {
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

      // Verify backup file was created
      const backupExists = await fs
        .access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      // Verify credentials are cleared
      const credentials = await service.list();
      expect(credentials).toHaveLength(0);
    });
  });

  describe("TOML file format", () => {
    test("persists credentials in correct TOML format", async () => {
      await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "myapikey",
      });

      const content = await fs.readFile(credentialsPath, "utf-8");

      // Should have credentials section with name as key
      expect(content).toContain("[credentials.my-server]");
      expect(content).toContain('api_key = "myapikey"');
      expect(content).toContain('url = "https://connect.example.com/"');
      expect(content).toContain('server_type = "connect"');
    });

    test("reads existing TOML file", async () => {
      const tomlContent = `[credentials.existing-server]
guid = "12345678-1234-1234-1234-123456789012"
version = 3
url = "https://existing.example.com/"
server_type = "connect"
api_key = "existingkey"
`;
      await fs.writeFile(credentialsPath, tomlContent);

      const credentials = await service.list();
      expect(credentials).toHaveLength(1);
      expect(credentials[0]?.name).toBe("existing-server");
      expect(credentials[0]?.apiKey).toBe("existingkey");
    });
  });

  describe("concurrent access", () => {
    test("handles concurrent reads safely", async () => {
      await service.set({
        name: "my-server",
        url: "https://connect.example.com",
        serverType: ServerType.CONNECT,
        apiKey: "key",
      });

      // Run multiple concurrent reads
      const results = await Promise.all([
        service.list(),
        service.list(),
        service.list(),
      ]);

      // All should return the same data
      for (const creds of results) {
        expect(creds).toHaveLength(1);
        expect(creds[0]?.name).toBe("my-server");
      }
    });
  });
});
