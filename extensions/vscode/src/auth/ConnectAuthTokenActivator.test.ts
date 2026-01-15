// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { window, env } from "vscode";
import { ConnectAuthTokenActivator } from "./ConnectAuthTokenActivator";
import { useApi } from "src/api";

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

vi.mock("src/api", () => ({
  useApi: vi.fn(),
}));

vi.mock("src/utils/progress", () => ({
  showProgress: vi.fn((_, __, callback) => callback()),
}));

vi.mock("src/utils/errors", () => ({
  getMessageFromError: vi.fn((error) => error?.message || "Unknown error"),
}));

vi.mock("src/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Type guards for mocked functions
const mockUseApi = vi.mocked(useApi);
const mockShowErrorMessage = vi.mocked(window.showErrorMessage);
const mockOpenExternal = vi.mocked(env.openExternal);

describe("ConnectAuthTokenActivator", () => {
  let activator: ConnectAuthTokenActivator;
  let mockApi: {
    credentials: {
      generateToken: ReturnType<typeof vi.fn>;
      verifyToken: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      credentials: {
        generateToken: vi.fn(),
        verifyToken: vi.fn(),
      },
    };
    mockUseApi.mockResolvedValue(
      mockApi as unknown as Awaited<ReturnType<typeof useApi>>,
    );

    activator = new ConnectAuthTokenActivator(
      "https://connect.example.com",
      "test-view-id",
    );
  });

  test("constructor initializes properties correctly", () => {
    expect(activator).toBeDefined();
  });

  test("initialize() calls useApi and sets up the API client", async () => {
    await activator.initialize();
    expect(mockUseApi).toHaveBeenCalledOnce();
  });

  test("activateToken() completes the full token authentication flow", async () => {
    // Setup mocks
    mockApi.credentials.generateToken.mockResolvedValue({
      data: {
        token: "test-token-123",
        claimUrl: "https://connect.example.com/claim/123",
        privateKey: "test-private-key-123",
        serverUrl: "https://connect.example.com",
      },
    });

    mockApi.credentials.verifyToken.mockResolvedValue({
      status: 200,
      data: { username: "testuser" },
    });

    // Initialize and run
    await activator.initialize();
    const result = await activator.activateToken();

    // Verify the flow
    expect(mockApi.credentials.generateToken).toHaveBeenCalledWith(
      "https://connect.example.com",
    );
    expect(mockOpenExternal).toHaveBeenCalledWith(
      expect.objectContaining({}), // Uri.parse result
    );
    expect(mockApi.credentials.verifyToken).toHaveBeenCalledWith(
      "https://connect.example.com",
      "test-token-123",
      "test-private-key-123",
    );

    // Verify result
    expect(result).toEqual({
      token: "test-token-123",
      privateKey: "test-private-key-123",
      userName: "testuser",
      serverUrl: "https://connect.example.com",
    });
  });

  test("activateToken() handles discovered server URL", async () => {
    // Setup mocks with discovered URL
    mockApi.credentials.generateToken.mockResolvedValue({
      data: {
        token: "test-token-123",
        claimUrl: "https://connect.example.com/claim/123",
        privateKey: "test-private-key-123",
        serverUrl: "https://connect.example.com",
      },
    });

    mockApi.credentials.verifyToken.mockResolvedValue({
      status: 200,
      data: { username: "testuser" },
    });

    // Initialize and run
    await activator.initialize();
    const result = await activator.activateToken();

    // Verify the discovered URL is used for verification
    expect(mockApi.credentials.verifyToken).toHaveBeenCalledWith(
      "https://connect.example.com",
      "test-token-123",
      "test-private-key-123",
    );

    expect(result).toEqual({
      token: "test-token-123",
      privateKey: "test-private-key-123",
      userName: "testuser",
      serverUrl: "https://connect.example.com",
    });
  });

  test("activateToken() handles token verification polling with retries", async () => {
    // Setup mocks
    mockApi.credentials.generateToken.mockResolvedValue({
      data: {
        token: "test-token-123",
        claimUrl: "https://connect.example.com/claim/123",
        privateKey: "test-private-key-123",
        serverUrl: "https://connect.example.com",
      },
    });

    // Mock verification to fail a few times, then succeed
    mockApi.credentials.verifyToken
      .mockRejectedValueOnce(new Error("401 Unauthorized"))
      .mockRejectedValueOnce(new Error("401 Unauthorized"))
      .mockResolvedValueOnce({
        status: 200,
        data: { username: "testuser" },
      });

    // Initialize and run
    await activator.initialize();
    const result = await activator.activateToken();

    // Verify multiple verification attempts
    expect(mockApi.credentials.verifyToken).toHaveBeenCalledTimes(3);
    expect(result.userName).toBe("testuser");
  });

  test("activateToken() throws error when not initialized", async () => {
    // Don't call initialize()
    await expect(activator.activateToken()).rejects.toThrow(
      "ConnectAuthTokenActivator must be initialized before use",
    );
  });

  test("activateToken() handles token generation failure", async () => {
    mockApi.credentials.generateToken.mockRejectedValue(
      new Error("Failed to generate token"),
    );

    await activator.initialize();

    await expect(activator.activateToken()).rejects.toThrow(
      "Failed to generate token",
    );
    expect(mockShowErrorMessage).toHaveBeenCalledWith(
      "Failed to complete token authentication: Failed to generate token",
    );
  });

  test("activateToken() handles timeout when token claim takes too long", async () => {
    // Setup mocks
    mockApi.credentials.generateToken.mockResolvedValue({
      data: {
        token: "test-token-123",
        claimUrl: "https://connect.example.com/claim/123",
        privateKey: "test-private-key-123",
        serverUrl: "https://connect.example.com",
      },
    });

    // Mock verification to always fail (simulating timeout)
    mockApi.credentials.verifyToken.mockRejectedValue(
      new Error("401 Unauthorized"),
    );

    // Create activator with reduced maxAttempts for faster testing
    const fastActivator = new ConnectAuthTokenActivator(
      "https://connect.example.com",
      "test-view-id",
      2, // maxAttempts
    );
    await fastActivator.initialize();

    await expect(fastActivator.activateToken()).rejects.toThrow(
      "Token claim process timed out or was cancelled",
    );
  });
});
