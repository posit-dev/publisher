// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock ConnectAPI (hoisted so vi.mock factory can reference it)
// ---------------------------------------------------------------------------

const { mockTestAuthentication } = vi.hoisted(() => ({
  mockTestAuthentication: vi.fn(),
}));

vi.mock("@posit-dev/connect-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@posit-dev/connect-api")>();
  return {
    ...actual,
    ConnectAPI: vi.fn(function () {
      return { testAuthentication: mockTestAuthentication };
    }),
  };
});

vi.mock("./connections");
vi.mock("./tokenProviders");

import { ConnectAPI } from "@posit-dev/connect-api";
import { listConnections } from "./connections";
import { createTokenProvider } from "./tokenProviders";

import { discoverSnowflakeConnections } from "./discovery";

const mockListConnections = vi.mocked(listConnections);
const mockCreateTokenProvider = vi.mocked(createTokenProvider);
const MockConnectAPI = ConnectAPI as unknown as ReturnType<typeof vi.fn>;

describe("discoverSnowflakeConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated connections with working URLs", async () => {
    mockListConnections.mockReturnValue({
      default: {
        account: "myaccount",
        user: "myuser",
        authenticator: "snowflake_jwt",
        private_key_file: "/path/to/key.p8",
      },
    });

    const mockGetToken = vi.fn().mockResolvedValue("sf-token-123");
    mockCreateTokenProvider.mockReturnValue({ getToken: mockGetToken });

    mockTestAuthentication.mockResolvedValue({ user: {}, error: null });

    const result = await discoverSnowflakeConnections(
      "https://example.snowflakecomputing.app",
    );

    expect(result).toEqual([
      { name: "default", serverUrl: "https://example.snowflakecomputing.app" },
    ]);

    expect(MockConnectAPI).toHaveBeenCalledWith({
      url: "https://example.snowflakecomputing.app",
      snowflakeToken: "sf-token-123",
      timeout: 30000,
    });
  });

  it("tries URL candidates and returns first working URL per connection", async () => {
    mockListConnections.mockReturnValue({
      default: {
        account: "myaccount",
        user: "myuser",
        authenticator: "oauth",
        token: "my-token",
      },
    });

    const mockGetToken = vi.fn().mockResolvedValue("sf-token-abc");
    mockCreateTokenProvider.mockReturnValue({ getToken: mockGetToken });

    // Input URL with path — getListOfPossibleURLs will generate candidates:
    // ["https://example.snowflakecomputing.app", "https://example.snowflakecomputing.app/connect"]
    // First call (base URL) fails, second call (with path) succeeds.
    mockTestAuthentication
      .mockRejectedValueOnce(new Error("auth failed"))
      .mockResolvedValueOnce({ user: {}, error: null });

    const result = await discoverSnowflakeConnections(
      "https://example.snowflakecomputing.app/connect",
    );

    expect(result).toEqual([
      {
        name: "default",
        serverUrl: "https://example.snowflakecomputing.app/connect",
      },
    ]);
    expect(mockTestAuthentication).toHaveBeenCalledTimes(2);
  });

  it("skips connections that fail token generation", async () => {
    mockListConnections.mockReturnValue({
      broken: {
        account: "brokenaccount",
        user: "brokenuser",
        authenticator: "snowflake_jwt",
        // missing private_key_file — will throw in createTokenProvider
      },
      working: {
        account: "workingaccount",
        user: "workinguser",
        authenticator: "oauth",
        token: "my-token",
      },
    });

    mockCreateTokenProvider
      .mockImplementationOnce(() => {
        throw new Error("private_key_file is required for snowflake_jwt");
      })
      .mockReturnValueOnce({
        getToken: vi.fn().mockResolvedValue("sf-token-working"),
      });

    mockTestAuthentication.mockResolvedValue({ user: {}, error: null });

    const result = await discoverSnowflakeConnections(
      "https://example.snowflakecomputing.app",
    );

    expect(result).toEqual([
      { name: "working", serverUrl: "https://example.snowflakecomputing.app" },
    ]);
  });

  it("returns empty array when no connections configured", async () => {
    mockListConnections.mockReturnValue({});

    const result = await discoverSnowflakeConnections(
      "https://example.snowflakecomputing.app",
    );

    expect(result).toEqual([]);
    expect(MockConnectAPI).not.toHaveBeenCalled();
  });

  it("returns empty array when all connections fail token generation", async () => {
    mockListConnections.mockReturnValue({
      default: {
        account: "myaccount",
        user: "myuser",
        authenticator: "oauth",
        token: "my-token",
      },
    });

    const mockGetToken = vi.fn().mockRejectedValue(new Error("token error"));
    mockCreateTokenProvider.mockReturnValue({ getToken: mockGetToken });

    const result = await discoverSnowflakeConnections(
      "https://example.snowflakecomputing.app",
    );

    expect(result).toEqual([]);
    expect(mockTestAuthentication).not.toHaveBeenCalled();
  });
});
