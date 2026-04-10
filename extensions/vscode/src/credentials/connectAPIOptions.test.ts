// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it, vi } from "vitest";

import { connectAPIOptionsFromCredential } from "./service";

vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("src/api", () => ({
  useApi: vi.fn(),
}));

vi.mock("src/config", () => ({
  default: {
    connectCloudURL: "https://connect.posit.cloud",
  },
}));

vi.mock("src/constants", () => ({
  CONNECT_CLOUD_ENV: "production",
}));

describe("connectAPIOptionsFromCredential", () => {
  describe("API key auth", () => {
    it("returns apiKey options when apiKey is present", () => {
      const result = connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "my-key",
        token: "",
        privateKey: "",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
        apiKey: "my-key",
      });
    });
  });

  describe("token auth", () => {
    it("returns token options when token and privateKey are present", () => {
      const result = connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "",
        token: "my-token",
        privateKey: "my-private-key",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
        token: "my-token",
        privateKey: "my-private-key",
      });
    });

    it("prefers token auth over API key auth when both are present", () => {
      const result = connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "my-key",
        token: "my-token",
        privateKey: "my-private-key",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
        token: "my-token",
        privateKey: "my-private-key",
      });
    });
  });

  describe("no auth", () => {
    it("returns url-only options when no auth fields are set", () => {
      const result = connectAPIOptionsFromCredential({
        url: "https://connect.example.com",
        apiKey: "",
        token: "",
        privateKey: "",
      });

      expect(result).toEqual({
        url: "https://connect.example.com",
      });
    });
  });

  describe("extra options", () => {
    it("spreads extra options onto the result", () => {
      const result = connectAPIOptionsFromCredential(
        {
          url: "https://connect.example.com",
          apiKey: "my-key",
          token: "",
          privateKey: "",
        },
        { rejectUnauthorized: false, timeout: 5000 },
      );

      expect(result).toEqual({
        url: "https://connect.example.com",
        apiKey: "my-key",
        rejectUnauthorized: false,
        timeout: 5000,
      });
    });
  });
});
