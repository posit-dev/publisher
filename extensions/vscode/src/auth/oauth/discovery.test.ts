// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

vi.mock("./httpClient", () => ({
  createOAuthHttpClient: vi.fn(() => ({ get: mockGet })),
  OAUTH_TIMEOUT_MS: 30_000,
}));

vi.mock("src/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { discoverOAuthMetadata } from "./discovery";

const VALID_METADATA = {
  issuer: "https://connect.example.com",
  authorization_endpoint: "https://connect.example.com/oauth/v1/authorize",
  token_endpoint: "https://connect.example.com/oauth/v1/token",
  registration_endpoint: "https://connect.example.com/oauth/v1/register",
};

beforeEach(() => {
  mockGet.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("discoverOAuthMetadata", () => {
  it("returns metadata on a 200 with the required endpoints", async () => {
    mockGet.mockResolvedValue({ status: 200, data: VALID_METADATA });

    const metadata = await discoverOAuthMetadata(
      "https://connect.example.com",
      false,
    );

    expect(metadata).toEqual(VALID_METADATA);
    expect(mockGet).toHaveBeenCalledWith(
      "https://connect.example.com/.well-known/oauth-authorization-server",
    );
  });

  it("strips a trailing slash from the server URL when building the probe URL", async () => {
    mockGet.mockResolvedValue({ status: 200, data: VALID_METADATA });
    await discoverOAuthMetadata("https://connect.example.com/", false);
    expect(mockGet).toHaveBeenCalledWith(
      "https://connect.example.com/.well-known/oauth-authorization-server",
    );
  });

  it("returns null on 404", async () => {
    mockGet.mockResolvedValue({ status: 404, data: "Not Found" });
    expect(
      await discoverOAuthMetadata("https://connect.example.com", false),
    ).toBeNull();
  });

  it("returns null when the body is missing required endpoints", async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: { issuer: "https://connect.example.com" },
    });
    expect(
      await discoverOAuthMetadata("https://connect.example.com", false),
    ).toBeNull();
  });

  it("returns null when the body is a non-JSON string (HTML proxy)", async () => {
    mockGet.mockResolvedValue({ status: 200, data: "<html>login</html>" });
    expect(
      await discoverOAuthMetadata("https://connect.example.com", false),
    ).toBeNull();
  });

  it("returns null on a network/TLS failure", async () => {
    mockGet.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(
      await discoverOAuthMetadata("https://connect.example.com", false),
    ).toBeNull();
  });
});
