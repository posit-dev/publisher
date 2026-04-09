// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  generateToken,
  generateKeyPair,
  generateTokenId,
} from "./generateToken";

vi.mock("src/logging");

// ---------------------------------------------------------------------------
// Mock discoverServerURL
// ---------------------------------------------------------------------------

vi.mock("src/utils/url", () => ({
  discoverServerURL: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ConnectAPI
// ---------------------------------------------------------------------------

const { mockRegisterToken: hoistedMockRegisterToken } = vi.hoisted(() => ({
  mockRegisterToken: vi.fn(),
}));

vi.mock("@posit-dev/connect-api", () => ({
  ConnectAPI: vi.fn(function () {
    return { registerToken: hoistedMockRegisterToken };
  }),
}));

import { discoverServerURL } from "src/utils/url";
import { ConnectAPI } from "@posit-dev/connect-api";

const mockDiscoverServerURL = vi.mocked(discoverServerURL);
const MockConnectAPI = vi.mocked(ConnectAPI);

describe("generateTokenId", () => {
  test("starts with 'T' followed by 32 hex characters", () => {
    const id = generateTokenId();
    expect(id).toMatch(/^T[0-9a-f]{32}$/);
  });

  test("generates unique IDs", () => {
    const id1 = generateTokenId();
    const id2 = generateTokenId();
    expect(id1).not.toBe(id2);
  });
});

describe("generateKeyPair", () => {
  test("returns base64-encoded private and public keys", () => {
    const { privateKey, publicKey } = generateKeyPair();

    // Both should be non-empty base64 strings
    expect(privateKey.length).toBeGreaterThan(0);
    expect(publicKey.length).toBeGreaterThan(0);

    // Should be valid base64
    expect(() => Buffer.from(privateKey, "base64")).not.toThrow();
    expect(() => Buffer.from(publicKey, "base64")).not.toThrow();
  });

  test("private key is valid PKCS#1 DER", () => {
    const { privateKey } = generateKeyPair();
    const derBuffer = Buffer.from(privateKey, "base64");

    // Should parse as a PKCS#1 private key without error
    const key = crypto.createPrivateKey({
      key: derBuffer,
      format: "der",
      type: "pkcs1",
    });
    expect(key.type).toBe("private");
  });

  test("public key is valid SPKI DER", () => {
    const { publicKey } = generateKeyPair();
    const derBuffer = Buffer.from(publicKey, "base64");

    // Should parse as a SPKI public key without error
    const key = crypto.createPublicKey({
      key: derBuffer,
      format: "der",
      type: "spki",
    });
    expect(key.type).toBe("public");
  });
});

describe("generateToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns token, claimUrl, privateKey, and discovered serverUrl on success", async () => {
    hoistedMockRegisterToken.mockResolvedValue({
      token_claim_url: "https://connect.example.com/connect/#/claim/abc123",
    });

    mockDiscoverServerURL.mockImplementation(async (_url, tester) => {
      await tester("https://connect.example.com");
      return { url: "https://connect.example.com" };
    });

    const result = await generateToken("https://connect.example.com");

    expect(result.token).toMatch(/^T[0-9a-f]{32}$/);
    expect(result.claimUrl).toBe(
      "https://connect.example.com/connect/#/claim/abc123",
    );
    expect(result.privateKey.length).toBeGreaterThan(0);
    expect(result.serverUrl).toBe("https://connect.example.com");
  });

  test("passes insecure flag through to ConnectAPI as rejectUnauthorized", async () => {
    hoistedMockRegisterToken.mockResolvedValue({
      token_claim_url: "https://connect.example.com/connect/#/claim/abc123",
    });

    mockDiscoverServerURL.mockImplementation(async (_url, tester) => {
      await tester("https://connect.example.com");
      return { url: "https://connect.example.com" };
    });

    await generateToken("https://connect.example.com", true);

    expect(MockConnectAPI).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://connect.example.com",
        rejectUnauthorized: false,
      }),
    );
  });

  test("throws when discovery fails for all candidate URLs", async () => {
    mockDiscoverServerURL.mockResolvedValue({
      url: "https://connect.example.com",
      error: new Error("connection refused"),
    });

    await expect(generateToken("https://connect.example.com")).rejects.toThrow(
      "connection refused",
    );
  });

  test("uses discovered URL (not provided URL) in the result", async () => {
    hoistedMockRegisterToken.mockResolvedValue({
      token_claim_url: "https://connect.example.com/connect/#/claim/abc123",
    });

    mockDiscoverServerURL.mockImplementation(async (_url, tester) => {
      await tester("https://connect.example.com/rsc");
      return { url: "https://connect.example.com/rsc" };
    });

    const result = await generateToken(
      "https://connect.example.com/rsc/extra/path",
    );
    expect(result.serverUrl).toBe("https://connect.example.com/rsc");
  });
});
