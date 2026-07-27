// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { generatePkcePair, generateState } from "./pkce";

describe("generatePkcePair", () => {
  it("produces a verifier and an S256 challenge derived from it", () => {
    const { verifier, challenge } = generatePkcePair();

    // Verifier is base64url (no +/= padding) and within RFC 7636 length bounds.
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);

    // challenge === BASE64URL(SHA256(verifier))
    const expected = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    expect(challenge).toBe(expected);
  });

  it("produces a unique verifier each call", () => {
    expect(generatePkcePair().verifier).not.toBe(generatePkcePair().verifier);
  });
});

describe("generateState", () => {
  it("produces a random base64url string", () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(generateState()).not.toBe(state);
  });
});
