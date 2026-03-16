// Copyright (C) 2026 by Posit Software, PBC.

import { describe, test, expect, vi, beforeEach } from "vitest";
import { fetchServerSettings } from "./connectServerSettings";
import { ServerSettings } from "src/api/types/connect";

const mockGet = vi.fn();

vi.mock("axios", () => ({
  default: { get: mockGet },
}));

describe("fetchServerSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls correct URL with auth header and timeout", async () => {
    const settings: ServerSettings = {
      license: { "oauth-integrations": true },
      oauth_integrations_enabled: true,
    };
    mockGet.mockResolvedValue({ data: settings });

    await fetchServerSettings("https://connect.example.com", "my-api-key");

    expect(mockGet).toHaveBeenCalledWith(
      "https://connect.example.com/__api__/server_settings",
      {
        headers: { Authorization: "Key my-api-key" },
        timeout: 30_000,
      },
    );
  });

  test("returns parsed server settings", async () => {
    const settings: ServerSettings = {
      license: { "oauth-integrations": false },
      oauth_integrations_enabled: false,
    };
    mockGet.mockResolvedValue({ data: settings });

    const result = await fetchServerSettings(
      "https://connect.example.com",
      "key",
    );

    expect(result).toEqual(settings);
  });

  test("throws on network error", async () => {
    mockGet.mockRejectedValue(new Error("Network Error"));

    await expect(
      fetchServerSettings("https://connect.example.com", "key"),
    ).rejects.toThrow("Network Error");
  });
});
