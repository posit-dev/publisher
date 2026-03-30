// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  md5Checksum,
  buildCanonicalRequest,
  rsaSha1Sign,
  signRequest,
} from "./auth.js";

// ---------------------------------------------------------------------------
// Generate a test RSA key pair (PKCS#1 DER, base64-encoded)
// ---------------------------------------------------------------------------

function generateTestKeyPair(): {
  privateKeyBase64: string;
  publicKeyBase64: string;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs1" });
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  return {
    privateKeyBase64: Buffer.from(privateKeyDer).toString("base64"),
    publicKeyBase64: Buffer.from(publicKeyDer).toString("base64"),
  };
}

// ---------------------------------------------------------------------------
// md5Checksum
// ---------------------------------------------------------------------------

describe("md5Checksum", () => {
  it("returns base64(MD5('')) for undefined body", () => {
    const expected = crypto.createHash("md5").update("").digest("base64");
    expect(md5Checksum(undefined)).toBe(expected);
  });

  it("returns base64(MD5('')) for empty string body", () => {
    const expected = crypto.createHash("md5").update("").digest("base64");
    expect(md5Checksum("")).toBe(expected);
  });

  it("returns correct checksum for non-empty body", () => {
    const body = '{"name":"my-app"}';
    const expected = crypto.createHash("md5").update(body).digest("base64");
    expect(md5Checksum(body)).toBe(expected);
  });

  it("empty and undefined produce the same checksum", () => {
    expect(md5Checksum(undefined)).toBe(md5Checksum(""));
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalRequest
// ---------------------------------------------------------------------------

describe("buildCanonicalRequest", () => {
  it("joins method, path, date, checksum with newlines", () => {
    const result = buildCanonicalRequest(
      "GET",
      "/__api__/v1/user",
      "Thu, 01 Jan 2026 12:00:00 GMT",
      "abc123==",
    );
    expect(result).toBe(
      "GET\n/__api__/v1/user\nThu, 01 Jan 2026 12:00:00 GMT\nabc123==",
    );
  });

  it("works with POST method and different path", () => {
    const result = buildCanonicalRequest(
      "POST",
      "/__api__/v1/content",
      "Fri, 02 Jan 2026 08:30:00 GMT",
      "xyz789==",
    );
    expect(result).toBe(
      "POST\n/__api__/v1/content\nFri, 02 Jan 2026 08:30:00 GMT\nxyz789==",
    );
  });
});

// ---------------------------------------------------------------------------
// rsaSha1Sign
// ---------------------------------------------------------------------------

describe("rsaSha1Sign", () => {
  it("produces a valid base64-encoded signature", () => {
    const { privateKeyBase64 } = generateTestKeyPair();
    const canonical = "GET\n/path\ndate\nchecksum";
    const signature = rsaSha1Sign(canonical, privateKeyBase64);

    // Should be valid base64
    expect(() => Buffer.from(signature, "base64")).not.toThrow();
    // RSA-2048 signature is 256 bytes = 344 base64 chars (with padding)
    expect(Buffer.from(signature, "base64").length).toBe(256);
  });

  it("produces a signature verifiable with the corresponding public key", () => {
    const { privateKeyBase64, publicKeyBase64 } = generateTestKeyPair();
    const canonical = "POST\n/__api__/v1/content\ndate\nchecksum==";
    const signature = rsaSha1Sign(canonical, privateKeyBase64);

    // Verify the signature using the public key
    const publicKeyDer = Buffer.from(publicKeyBase64, "base64");
    const publicKey = crypto.createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });
    const verifier = crypto.createVerify("SHA1");
    verifier.update(canonical);
    expect(verifier.verify(publicKey, signature, "base64")).toBe(true);
  });

  it("throws for an invalid private key", () => {
    expect(() => rsaSha1Sign("data", "not-valid-base64-key")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// signRequest
// ---------------------------------------------------------------------------

describe("signRequest", () => {
  it("returns all four required headers", () => {
    const { privateKeyBase64 } = generateTestKeyPair();
    const headers = signRequest(
      "GET",
      "/__api__/v1/user",
      undefined,
      "T1234567890abcdef",
      privateKeyBase64,
    );

    expect(headers).toHaveProperty("Date");
    expect(headers).toHaveProperty("X-Content-Checksum");
    expect(headers).toHaveProperty("X-Auth-Token");
    expect(headers).toHaveProperty("X-Auth-Signature");
  });

  it("sets X-Auth-Token to the provided token", () => {
    const { privateKeyBase64 } = generateTestKeyPair();
    const token = "Tabc123def456";
    const headers = signRequest(
      "GET",
      "/path",
      undefined,
      token,
      privateKeyBase64,
    );

    expect(headers["X-Auth-Token"]).toBe(token);
  });

  it("computes checksum for empty body as MD5 of empty string", () => {
    const { privateKeyBase64 } = generateTestKeyPair();
    const headers = signRequest(
      "GET",
      "/path",
      undefined,
      "token",
      privateKeyBase64,
    );
    const emptyMd5 = crypto.createHash("md5").update("").digest("base64");

    expect(headers["X-Content-Checksum"]).toBe(emptyMd5);
  });

  it("computes checksum for non-empty body", () => {
    const { privateKeyBase64 } = generateTestKeyPair();
    const body = '{"key":"value"}';
    const headers = signRequest(
      "POST",
      "/path",
      body,
      "token",
      privateKeyBase64,
    );
    const expectedMd5 = crypto.createHash("md5").update(body).digest("base64");

    expect(headers["X-Content-Checksum"]).toBe(expectedMd5);
  });

  it("Date header is a valid UTC date string", () => {
    const { privateKeyBase64 } = generateTestKeyPair();
    const headers = signRequest(
      "GET",
      "/path",
      undefined,
      "token",
      privateKeyBase64,
    );

    // Date.parse should not return NaN for a valid date string
    expect(Date.parse(headers["Date"])).not.toBeNaN();
    expect(headers["Date"]).toMatch(/GMT$/);
  });

  it("signature is verifiable", () => {
    const { privateKeyBase64, publicKeyBase64 } = generateTestKeyPair();
    const body = '{"name":"test"}';
    const headers = signRequest(
      "POST",
      "/__api__/v1/content",
      body,
      "Ttoken123",
      privateKeyBase64,
    );

    // Reconstruct canonical request from headers
    const checksum = headers["X-Content-Checksum"];
    const date = headers["Date"];
    const canonical = `POST\n/__api__/v1/content\n${date}\n${checksum}`;

    const publicKeyDer = Buffer.from(publicKeyBase64, "base64");
    const publicKey = crypto.createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });
    const verifier = crypto.createVerify("SHA1");
    verifier.update(canonical);
    expect(
      verifier.verify(publicKey, headers["X-Auth-Signature"], "base64"),
    ).toBe(true);
  });
});
