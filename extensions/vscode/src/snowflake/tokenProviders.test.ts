// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios");
import axios from "axios";

vi.mock("snowflake-sdk");
import snowflake from "snowflake-sdk";

import { createTokenProvider } from "./tokenProviders";

describe("createTokenProvider", () => {
  it("throws for unsupported authenticator type", () => {
    expect(() =>
      createTokenProvider({
        account: "myaccount",
        user: "myuser",
        authenticator: "unsupported",
      }),
    ).toThrow('unsupported authenticator type: "unsupported"');
  });
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

  it("throws when private_key_file is missing", () => {
    expect(() =>
      createTokenProvider({
        account: "myaccount",
        user: "myuser",
        authenticator: "snowflake_jwt",
      }),
    ).toThrow("private_key_file is required for snowflake_jwt");
  });

  it("creates connection with correct account, username, authenticator, and privateKeyPath", async () => {
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "snowflake_jwt",
      private_key_file: "/path/to/key.p8",
    });
    await provider.getToken("ignored-hostname");
    expect(snowflake.createConnection).toHaveBeenCalledWith({
      account: "myaccount",
      username: "myuser",
      authenticator: "SNOWFLAKE_JWT",
      privateKeyPath: "/path/to/key.p8",
      clientStoreTemporaryCredential: true,
    });
  });

  it("returns the session token from serialized connection state", async () => {
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "snowflake_jwt",
      private_key_file: "/path/to/key.p8",
    });
    const token = await provider.getToken("ignored-hostname");
    expect(token).toBe("mock-jwt-token-123");
  });

  it("throws if session token is absent from serialized state", async () => {
    mockSerialize.mockReturnValue(JSON.stringify({ services: {} }));
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "snowflake_jwt",
      private_key_file: "/path/to/key.p8",
    });
    await expect(provider.getToken("ignored-hostname")).rejects.toThrow(
      "missing session token",
    );
  });

  it("throws if connectAsync rejects", async () => {
    mockConnectAsync.mockRejectedValue(new Error("jwt auth failed"));
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "snowflake_jwt",
      private_key_file: "/path/to/key.p8",
    });
    await expect(provider.getToken("ignored-hostname")).rejects.toThrow(
      "jwt auth failed",
    );
  });
});

describe("OAuth token provider (oauth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends login-request with correct body and headers", async () => {
    const mockPost = vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {
          token: "session-token-value",
        },
      },
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    await provider.getToken("example.snowflakecomputing.app");

    expect(mockPost).toHaveBeenCalledOnce();

    const [url, body, config] = mockPost.mock.calls[0]!;
    expect(url).toBe(
      "https://myaccount.snowflakecomputing.com/session/v1/login-request",
    );
    expect(body).toEqual({
      data: {
        ACCOUNT_NAME: "myaccount",
        TOKEN: "my-oauth-token",
        AUTHENTICATOR: "OAUTH",
      },
    });
    expect(config).toMatchObject({
      headers: {
        "Content-Type": "application/json",
        Accept: "application/snowflake",
      },
    });
  });

  it("returns the session token from data.data.token", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {
          token: "my-session-token",
        },
      },
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    const result = await provider.getToken("example.snowflakecomputing.app");
    expect(result).toBe("my-session-token");
  });

  it("throws when login response is missing token", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {},
      },
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    await expect(
      provider.getToken("example.snowflakecomputing.app"),
    ).rejects.toThrow("missing token in login response");
  });

  it("throws when login endpoint returns an HTTP error", async () => {
    vi.mocked(axios.post).mockRejectedValue(
      new Error("Request failed with status code 500"),
    );

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    await expect(
      provider.getToken("example.snowflakecomputing.app"),
    ).rejects.toThrow();
  });

  it("throws when login response body is not valid JSON structure", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: "notjson",
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    await expect(
      provider.getToken("example.snowflakecomputing.app"),
    ).rejects.toThrow("missing token in login response");
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
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "externalbrowser",
    });
    await provider.getToken("ignored-hostname");
    expect(snowflake.createConnection).toHaveBeenCalledWith({
      account: "myaccount",
      username: "myuser",
      authenticator: "EXTERNALBROWSER",
      clientStoreTemporaryCredential: true,
    });
  });

  it("returns the session token from serialized connection state", async () => {
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "externalbrowser",
    });
    const token = await provider.getToken("ignored-hostname");
    expect(token).toBe("mock-token-abc");
  });

  it("throws if session token is absent from serialized state", async () => {
    mockSerialize.mockReturnValue(JSON.stringify({ services: {} }));
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "externalbrowser",
    });
    await expect(provider.getToken("ignored-hostname")).rejects.toThrow(
      "missing session token",
    );
  });

  it("throws if connectAsync rejects", async () => {
    mockConnectAsync.mockRejectedValue(new Error("browser auth failed"));
    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "externalbrowser",
    });
    await expect(provider.getToken("ignored-hostname")).rejects.toThrow(
      "browser auth failed",
    );
  });
});
