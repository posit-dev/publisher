// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { AxiosInstance } from "axios";
import { Credentials } from "./Credentials";
import { ServerType } from "../types/contentRecords";
import { CONNECT_CLOUD_ENV_HEADER } from "../../constants";
import { Credential } from "../types/credentials";

// Simple mock for the axios client
const mockAxiosPost = vi.fn();
const mockAxiosDelete = vi.fn();
const mockAxiosClient = {
  post: mockAxiosPost,
  get: vi.fn(),
  delete: mockAxiosDelete,
};

describe("Credentials API client", () => {
  let credentials: Credentials;

  beforeEach(() => {
    vi.clearAllMocks();
    credentials = new Credentials(mockAxiosClient as unknown as AxiosInstance);
  });

  test("create sends credential with Connect Cloud environment header", async () => {
    mockAxiosPost.mockResolvedValue({ data: { guid: "test-guid" } });

    const cred: Credential = {
      guid: "test-guid",
      name: "Test Credential",
      url: "https://connect.example.com",
      serverType: ServerType.CONNECT,
      apiKey: "test-key",
      snowflakeConnection: "",
      accountId: "",
      accountName: "",
      refreshToken: "",
      accessToken: "",
      cloudEnvironment: "",
      token: "",
      privateKey: "",
    };

    await credentials.create(cred);

    expect(mockAxiosPost).toHaveBeenCalledWith("credentials", cred, {
      headers: CONNECT_CLOUD_ENV_HEADER,
    });
  });

  test("create sends Connect Cloud credential with environment header", async () => {
    mockAxiosPost.mockResolvedValue({ data: { guid: "cloud-guid" } });

    const cred: Credential = {
      guid: "cloud-guid",
      name: "Cloud Credential",
      url: "https://connect.posit.cloud",
      serverType: ServerType.CONNECT_CLOUD,
      apiKey: "",
      snowflakeConnection: "",
      accountId: "acct-123",
      accountName: "Test Account",
      refreshToken: "refresh-tok",
      accessToken: "access-tok",
      cloudEnvironment: "production",
      token: "",
      privateKey: "",
    };

    await credentials.create(cred);

    expect(mockAxiosPost).toHaveBeenCalledWith("credentials", cred, {
      headers: CONNECT_CLOUD_ENV_HEADER,
    });
  });

  test("delete calls correct endpoint with guid", async () => {
    mockAxiosDelete.mockResolvedValue({ status: 204 });

    await credentials.delete("test-guid-123");

    expect(mockAxiosDelete).toHaveBeenCalledWith("credentials/test-guid-123");
  });

  test("reset calls correct endpoint", async () => {
    mockAxiosDelete.mockResolvedValue({ data: { backupFile: "" } });

    await credentials.reset();

    expect(mockAxiosDelete).toHaveBeenCalledWith("credentials");
  });

  test("generateToken calls the correct endpoint with server URL", async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        token: "test-token-123",
        claimUrl: "https://connect.example.com/claim/123",
        privateKey: "test-private-key-123",
      },
    });

    await credentials.generateToken("https://connect.example.com");

    expect(mockAxiosPost).toHaveBeenCalledWith("connect/token", {
      serverUrl: "https://connect.example.com",
    });
  });

  test("verifyToken calls the correct endpoint with token parameters", async () => {
    mockAxiosPost.mockResolvedValue({
      data: { username: "testuser", guid: "user-123" },
    });

    await credentials.verifyToken(
      "https://connect.example.com",
      "test-token-123",
      "test-private-key-123",
    );

    expect(mockAxiosPost).toHaveBeenCalledWith("connect/token/user", {
      serverUrl: "https://connect.example.com",
      token: "test-token-123",
      privateKey: "test-private-key-123",
    });
  });
});
