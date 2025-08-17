// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { AxiosInstance } from "axios";
import { Credentials } from "./Credentials";
import { ServerType } from "../types/contentRecords";
import { CONNECT_CLOUD_ENV_HEADER } from "../../constants";

// Simple mock for the axios client
const mockAxiosPost = vi.fn();
const mockAxiosClient = {
  post: mockAxiosPost,
  get: vi.fn(),
  delete: vi.fn(),
};

describe("Credentials API client", () => {
  let credentials: Credentials;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    credentials = new Credentials(mockAxiosClient as unknown as AxiosInstance);
  });

  test("connect create supports token authentication parameters", async () => {
    // Setup mock response
    mockAxiosPost.mockResolvedValue({ data: { guid: "test-guid" } });

    const data = {
      name: "Test Credential",
      url: "https://connect.example.com",
      apiKey: "",
      token: "test-token-123",
      privateKey: "test-private-key-123",
      snowflakeConnection: "",
    };

    // Call connect create with token parameters
    await credentials.connectCreate(data, ServerType.CONNECT);

    // Verify correct parameters were passed to axios post
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "credentials",
      {
        name: data.name,
        url: data.url,
        apiKey: data.apiKey,
        token: data.token,
        privateKey: data.privateKey,
        snowflakeConnection: data.snowflakeConnection,
        serverType: ServerType.CONNECT,
        accountId: "",
        accountName: "",
        refreshToken: "",
        accessToken: "",
      },
      {
        headers: { CONNECT_CLOUD_ENV_HEADER },
      },
    );
  });

  test("connect cloud create supports device authentication parameters", async () => {
    // Setup mock response
    mockAxiosPost.mockResolvedValue({ data: { guid: "test-guid" } });

    const data = {
      name: "Test Credential",
      accountId: "test-account",
      accountName: "Test Account",
      refreshToken: "refresh-token-test",
      accessToken: "access-token-test",
    };

    // Call connect cloud create with device auth parameters
    await credentials.connectCloudCreate(data, ServerType.CONNECT_CLOUD);

    // Verify correct parameters were passed to axios post
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "credentials",
      {
        name: data.name,
        accountId: data.accountId,
        accountName: data.accountName,
        refreshToken: data.refreshToken,
        accessToken: data.accessToken,
        serverType: ServerType.CONNECT_CLOUD,
        url: "",
        apiKey: "",
        token: "",
        privateKey: "",
        snowflakeConnection: "",
      },
      {
        headers: { CONNECT_CLOUD_ENV_HEADER },
      },
    );
  });

  test("generateToken calls the correct endpoint with server URL", async () => {
    // Setup mock response
    mockAxiosPost.mockResolvedValue({
      data: {
        token: "test-token-123",
        claimUrl: "https://connect.example.com/claim/123",
        privateKey: "test-private-key-123",
      },
    });

    // Call generateToken
    await credentials.generateToken("https://connect.example.com");

    // Verify correct parameters were passed to axios post
    expect(mockAxiosPost).toHaveBeenCalledWith("connect/token", {
      serverUrl: "https://connect.example.com",
    });
  });

  test("verifyToken calls the correct endpoint with token parameters", async () => {
    // Setup mock response
    mockAxiosPost.mockResolvedValue({
      data: { username: "testuser", guid: "user-123" },
    });

    // Call verifyToken
    await credentials.verifyToken(
      "https://connect.example.com",
      "test-token-123",
      "test-private-key-123",
    );

    // Verify correct parameters were passed to axios post
    expect(mockAxiosPost).toHaveBeenCalledWith("connect/token/user", {
      serverUrl: "https://connect.example.com",
      token: "test-token-123",
      privateKey: "test-private-key-123",
    });
  });
});
