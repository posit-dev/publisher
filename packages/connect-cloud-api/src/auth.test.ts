// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudAuthClient } from "./auth.js";
import { CloudEnvironment } from "./types.js";
import type { TokenResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Mock axios
// ---------------------------------------------------------------------------

const mockPost = vi.fn();

vi.mock("axios", () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
  mockPost.mockReset();
});

// ---------------------------------------------------------------------------
// CloudAuthClient
// ---------------------------------------------------------------------------

describe("CloudAuthClient", () => {
  const tokenResponse: TokenResponse = {
    access_token: "new-access-token",
    refresh_token: "new-refresh-token",
    expires_in: 3600,
    token_type: "Bearer",
    scope: "vivid",
  };

  describe("exchangeToken", () => {
    it("POSTs to /oauth/token with form-urlencoded body", async () => {
      mockPost.mockResolvedValue({ data: tokenResponse });

      const client = new CloudAuthClient(CloudEnvironment.Production);
      await client.exchangeToken({
        grant_type: "refresh_token",
        refresh_token: "my-refresh-token",
      });

      expect(mockPost).toHaveBeenCalledOnce();
      const [url, body, config] = mockPost.mock.calls[0];
      expect(url).toBe("https://login.posit.cloud/oauth/token");
      expect(config.headers["Content-Type"]).toBe(
        "application/x-www-form-urlencoded",
      );

      // Verify form body
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("client_id")).toBe("posit-publisher");
      expect(body.get("scope")).toBe("vivid");
      expect(body.get("refresh_token")).toBe("my-refresh-token");
    });

    it("returns TokenResponse", async () => {
      mockPost.mockResolvedValue({ data: tokenResponse });

      const client = new CloudAuthClient(CloudEnvironment.Production);
      const result = await client.exchangeToken({
        grant_type: "refresh_token",
        refresh_token: "my-refresh-token",
      });

      expect(result).toEqual(tokenResponse);
    });

    it("uses staging URL and client ID for Development environment", async () => {
      mockPost.mockResolvedValue({ data: tokenResponse });

      const client = new CloudAuthClient(CloudEnvironment.Development);
      await client.exchangeToken({
        grant_type: "refresh_token",
        refresh_token: "my-refresh-token",
      });

      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe("https://login.staging.posit.cloud/oauth/token");
      expect(body.get("client_id")).toBe("posit-publisher-development");
    });

    it("uses staging URL and client ID for Staging environment", async () => {
      mockPost.mockResolvedValue({ data: tokenResponse });

      const client = new CloudAuthClient(CloudEnvironment.Staging);
      await client.exchangeToken({
        grant_type: "refresh_token",
        refresh_token: "my-refresh-token",
      });

      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe("https://login.staging.posit.cloud/oauth/token");
      expect(body.get("client_id")).toBe("posit-publisher-staging");
    });

    it("throws on error", async () => {
      mockPost.mockRejectedValue(new Error("Network error"));

      const client = new CloudAuthClient(CloudEnvironment.Production);
      await expect(
        client.exchangeToken({
          grant_type: "refresh_token",
          refresh_token: "my-refresh-token",
        }),
      ).rejects.toThrow("Network error");
    });
  });
});
