// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { window, env } from "vscode";
import { ConnectAuthTokenActivator } from "./ConnectAuthTokenActivator";

// Mock dependencies
vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
    })),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  Uri: {
    parse: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
  },
}));

vi.mock("src/utils/progress", () => ({
  showProgress: vi.fn((_, __, callback) => callback()),
}));

vi.mock("src/utils/errors", () => ({
  getMessageFromError: vi.fn((error) => error?.message || "Unknown error"),
}));

vi.mock("src/logging");

// Mock generateToken
vi.mock("./generateToken", () => ({
  generateToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ConnectAPI using vi.hoisted to avoid arrow function constructor issue
// ---------------------------------------------------------------------------

const { mockTestAuthentication: hoistedMockTestAuthentication } = vi.hoisted(
  () => ({
    mockTestAuthentication: vi.fn(),
  }),
);

vi.mock("@posit-dev/connect-api", () => ({
  ConnectAPI: vi.fn(function () {
    return { testAuthentication: hoistedMockTestAuthentication };
  }),
  ConnectAPIError: class ConnectAPIError extends Error {
    httpStatus?: number;
    constructor(message: string, httpStatus?: number) {
      super(message);
      this.name = "ConnectAPIError";
      this.httpStatus = httpStatus;
    }
  },
}));

import { generateToken } from "./generateToken";
import { ConnectAPI, ConnectAPIError } from "@posit-dev/connect-api";

const mockGenerateToken = vi.mocked(generateToken);
const MockConnectAPI = vi.mocked(ConnectAPI);
const mockShowErrorMessage = vi.mocked(window.showErrorMessage);
const mockOpenExternal = vi.mocked(env.openExternal);

describe("ConnectAuthTokenActivator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("activateToken() completes the full token authentication flow", async () => {
    mockGenerateToken.mockResolvedValue({
      token: "test-token-123",
      claimUrl: "https://connect.example.com/claim/123",
      privateKey: "test-private-key-123",
      serverUrl: "https://connect.example.com",
    });

    hoistedMockTestAuthentication.mockResolvedValue({
      user: {
        id: "guid-1",
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        email: "t@t.com",
      },
      error: null,
    });

    const activator = new ConnectAuthTokenActivator(
      "https://connect.example.com",
      "test-view-id",
    );
    const result = await activator.activateToken();

    expect(mockGenerateToken).toHaveBeenCalledWith(
      "https://connect.example.com",
      undefined,
    );
    expect(mockOpenExternal).toHaveBeenCalled();
    expect(MockConnectAPI).toHaveBeenCalledWith({
      url: "https://connect.example.com",
      token: "test-token-123",
      privateKey: "test-private-key-123",
      rejectUnauthorized: undefined,
    });
    expect(result).toEqual({
      token: "test-token-123",
      privateKey: "test-private-key-123",
      userName: "testuser",
      serverUrl: "https://connect.example.com",
    });
  });

  test("activateToken() passes insecure flag through", async () => {
    mockGenerateToken.mockResolvedValue({
      token: "test-token-123",
      claimUrl: "https://connect.example.com/claim/123",
      privateKey: "test-private-key-123",
      serverUrl: "https://connect.example.com",
    });

    hoistedMockTestAuthentication.mockResolvedValue({
      user: {
        id: "guid-1",
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        email: "t@t.com",
      },
      error: null,
    });

    const activator = new ConnectAuthTokenActivator(
      "https://connect.example.com",
      "test-view-id",
      60,
      true,
    );
    const result = await activator.activateToken();

    expect(mockGenerateToken).toHaveBeenCalledWith(
      "https://connect.example.com",
      true,
    );
    expect(MockConnectAPI).toHaveBeenCalledWith({
      url: "https://connect.example.com",
      token: "test-token-123",
      privateKey: "test-private-key-123",
      rejectUnauthorized: false,
    });
    expect(result.userName).toBe("testuser");
  });

  test("activateToken() handles polling with retries on 401", async () => {
    mockGenerateToken.mockResolvedValue({
      token: "test-token-123",
      claimUrl: "https://connect.example.com/claim/123",
      privateKey: "test-private-key-123",
      serverUrl: "https://connect.example.com",
    });

    hoistedMockTestAuthentication
      .mockRejectedValueOnce(new ConnectAPIError("HTTP 401", 401))
      .mockRejectedValueOnce(new ConnectAPIError("HTTP 401", 401))
      .mockResolvedValueOnce({
        user: {
          id: "guid-1",
          username: "testuser",
          first_name: "Test",
          last_name: "User",
          email: "t@t.com",
        },
        error: null,
      });

    const activator = new ConnectAuthTokenActivator(
      "https://connect.example.com",
      "test-view-id",
    );
    const result = await activator.activateToken();

    expect(hoistedMockTestAuthentication).toHaveBeenCalledTimes(3);
    expect(result.userName).toBe("testuser");
  });

  test("activateToken() handles token generation failure", async () => {
    mockGenerateToken.mockRejectedValue(new Error("Failed to generate token"));

    const activator = new ConnectAuthTokenActivator(
      "https://connect.example.com",
      "test-view-id",
    );

    await expect(activator.activateToken()).rejects.toThrow(
      "Failed to generate token",
    );
    expect(mockShowErrorMessage).toHaveBeenCalledWith(
      "Failed to complete token authentication: Failed to generate token",
    );
  });

  test("activateToken() handles timeout when token claim takes too long", async () => {
    mockGenerateToken.mockResolvedValue({
      token: "test-token-123",
      claimUrl: "https://connect.example.com/claim/123",
      privateKey: "test-private-key-123",
      serverUrl: "https://connect.example.com",
    });

    hoistedMockTestAuthentication.mockRejectedValue(
      new ConnectAPIError("HTTP 401", 401),
    );

    const activator = new ConnectAuthTokenActivator(
      "https://connect.example.com",
      "test-view-id",
      2, // maxAttempts
    );

    await expect(activator.activateToken()).rejects.toThrow(
      "Token claim process timed out or was cancelled",
    );
  });
});
