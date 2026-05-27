// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("snowflake-sdk");
vi.mock("vscode");
vi.mock("src/logging");
import snowflake from "snowflake-sdk";
import { CredentialsService } from "src/credentials/service";
import { mockSecretStorage } from "src/test/unit-test-utils/vscode-mocks";

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
    const VALID_SERIALIZED = JSON.stringify({
      services: { sf: { tokenInfo: { sessionToken: "mock-jwt-token-123" } } },
    });

    let mockConnectAsync: ReturnType<typeof vi.fn>;
    let mockSerialize: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockConnectAsync = vi.fn().mockResolvedValue(undefined);
      mockSerialize = vi.fn().mockReturnValue(VALID_SERIALIZED);
      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnectAsync,
        serialize: mockSerialize,
      } as unknown as ReturnType<typeof snowflake.createConnection>);
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

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

    it("returns the session token from serialized connection state", async () => {
      const token = await service.getSnowflakeToken({
        account: "myaccount",
        user: "myuser",
        authenticator: "snowflake_jwt",
        private_key_file: "/path/to/key.p8",
      });
      expect(token).toBe("mock-jwt-token-123");
    });

    it("throws if session token is absent from serialized state", async () => {
      mockSerialize.mockReturnValue(JSON.stringify({ services: {} }));
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "snowflake_jwt",
          private_key_file: "/path/to/key.p8",
        }),
      ).rejects.toThrow("missing session token");
    });

    it("throws if connectAsync rejects", async () => {
      mockConnectAsync.mockRejectedValue(new Error("jwt auth failed"));
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "snowflake_jwt",
          private_key_file: "/path/to/key.p8",
        }),
      ).rejects.toThrow("jwt auth failed");
    });
  });

  describe("OAuth token provider (oauth)", () => {
    const VALID_SERIALIZED = JSON.stringify({
      services: { sf: { tokenInfo: { sessionToken: "mock-oauth-token-456" } } },
    });

    let mockConnectAsync: ReturnType<typeof vi.fn>;
    let mockSerialize: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockConnectAsync = vi.fn().mockResolvedValue(undefined);
      mockSerialize = vi.fn().mockReturnValue(VALID_SERIALIZED);
      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnectAsync,
        serialize: mockSerialize,
      } as unknown as ReturnType<typeof snowflake.createConnection>);
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

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

    it("returns the session token from serialized connection state", async () => {
      const token = await service.getSnowflakeToken({
        account: "myaccount",
        user: "myuser",
        authenticator: "oauth",
        token: "my-oauth-token",
      });
      expect(token).toBe("mock-oauth-token-456");
    });

    it("throws if session token is absent from serialized state", async () => {
      mockSerialize.mockReturnValue(JSON.stringify({ services: {} }));
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "oauth",
          token: "my-oauth-token",
        }),
      ).rejects.toThrow("missing session token");
    });

    it("throws if connectAsync rejects", async () => {
      mockConnectAsync.mockRejectedValue(new Error("oauth auth failed"));
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "oauth",
          token: "my-oauth-token",
        }),
      ).rejects.toThrow("oauth auth failed");
    });
  });

  describe("External browser token provider (externalbrowser)", () => {
    const VALID_SERIALIZED = JSON.stringify({
      services: { sf: { tokenInfo: { sessionToken: "mock-token-abc" } } },
    });

    let mockConnectAsync: ReturnType<typeof vi.fn>;
    let mockSerialize: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockConnectAsync = vi.fn().mockResolvedValue(undefined);
      mockSerialize = vi.fn().mockReturnValue(VALID_SERIALIZED);
      vi.mocked(snowflake.createConnection).mockReturnValue({
        connectAsync: mockConnectAsync,
        serialize: mockSerialize,
      } as unknown as ReturnType<typeof snowflake.createConnection>);
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("creates connection with correct account, username, and authenticator", async () => {
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

    it("returns the session token from serialized connection state", async () => {
      const token = await service.getSnowflakeToken({
        account: "myaccount",
        user: "myuser",
        authenticator: "externalbrowser",
      });
      expect(token).toBe("mock-token-abc");
    });

    it("throws if session token is absent from serialized state", async () => {
      mockSerialize.mockReturnValue(JSON.stringify({ services: {} }));
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "externalbrowser",
        }),
      ).rejects.toThrow("missing session token");
    });

    it("throws if connectAsync rejects", async () => {
      mockConnectAsync.mockRejectedValue(new Error("browser auth failed"));
      await expect(
        service.getSnowflakeToken({
          account: "myaccount",
          user: "myuser",
          authenticator: "externalbrowser",
        }),
      ).rejects.toThrow("browser auth failed");
    });
  });
});
