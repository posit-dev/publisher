// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudAuthClient } from "./auth.js";
import { CloudEnvironment } from "./types.js";
import type { DeviceAuthResponse, TokenResponse } from "./types.js";

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

    it("POSTs with device_code when using device code grant type", async () => {
      mockPost.mockResolvedValue({ data: tokenResponse });

      const client = new CloudAuthClient(CloudEnvironment.Production);
      await client.exchangeToken({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: "my-device-code",
      });

      expect(mockPost).toHaveBeenCalledOnce();
      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe("https://login.posit.cloud/oauth/token");
      expect(body.get("grant_type")).toBe(
        "urn:ietf:params:oauth:grant-type:device_code",
      );
      expect(body.get("device_code")).toBe("my-device-code");
      expect(body.get("client_id")).toBe("posit-publisher");
      expect(body.get("scope")).toBe("vivid");
      // refresh_token should NOT be present
      expect(body.has("refresh_token")).toBe(false);
    });
  });

  describe("createDeviceAuth", () => {
    const deviceAuthResponse: DeviceAuthResponse = {
      device_code: "test-device-code",
      user_code: "ABCD-1234",
      verification_uri: "https://login.posit.cloud/activate",
      verification_uri_complete:
        "https://login.posit.cloud/activate?user_code=ABCD-1234",
      expires_in: 900,
      interval: 5,
    };

    it("POSTs to /oauth/device/authorize with form-urlencoded body", async () => {
      mockPost.mockResolvedValue({ data: deviceAuthResponse });

      const client = new CloudAuthClient(CloudEnvironment.Production);
      await client.createDeviceAuth();

      expect(mockPost).toHaveBeenCalledOnce();
      const [url, body, config] = mockPost.mock.calls[0];
      expect(url).toBe("https://login.posit.cloud/oauth/device/authorize");
      expect(config.headers["Content-Type"]).toBe(
        "application/x-www-form-urlencoded",
      );

      // Verify form body
      expect(body.get("client_id")).toBe("posit-publisher");
      expect(body.get("scope")).toBe("vivid");
    });

    it("returns DeviceAuthResponse", async () => {
      mockPost.mockResolvedValue({ data: deviceAuthResponse });

      const client = new CloudAuthClient(CloudEnvironment.Production);
      const result = await client.createDeviceAuth();

      expect(result).toEqual(deviceAuthResponse);
    });

    it("uses staging URL and client ID for Development environment", async () => {
      mockPost.mockResolvedValue({ data: deviceAuthResponse });

      const client = new CloudAuthClient(CloudEnvironment.Development);
      await client.createDeviceAuth();

      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe(
        "https://login.staging.posit.cloud/oauth/device/authorize",
      );
      expect(body.get("client_id")).toBe("posit-publisher-development");
    });

    it("uses staging URL and client ID for Staging environment", async () => {
      mockPost.mockResolvedValue({ data: deviceAuthResponse });

      const client = new CloudAuthClient(CloudEnvironment.Staging);
      await client.createDeviceAuth();

      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe(
        "https://login.staging.posit.cloud/oauth/device/authorize",
      );
      expect(body.get("client_id")).toBe("posit-publisher-staging");
    });

    it("throws on error", async () => {
      mockPost.mockRejectedValue(new Error("Network error"));

      const client = new CloudAuthClient(CloudEnvironment.Production);
      await expect(client.createDeviceAuth()).rejects.toThrow("Network error");
    });
  });
});
