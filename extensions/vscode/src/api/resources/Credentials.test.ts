// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { AxiosInstance } from "axios";
import { Credentials } from "./Credentials";

// Simple mock for the axios client
const mockAxiosPost = vi.fn();
const mockAxiosClient = {
  post: mockAxiosPost,
};

describe("Credentials API client", () => {
  let credentials: Credentials;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    credentials = new Credentials(mockAxiosClient as unknown as AxiosInstance);
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
