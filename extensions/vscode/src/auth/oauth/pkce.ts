// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import { PkcePair } from "./types";

/** Base64url-encode a buffer (RFC 7636 uses base64url with no padding). */
function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64url");
}

/**
 * Generates a PKCE code verifier + S256 challenge pair (RFC 7636).
 * The verifier is 32 random bytes base64url-encoded (43 chars), well within the
 * 43–128 char range the spec allows. The challenge is BASE64URL(SHA256(verifier)).
 */
export function generatePkcePair(): PkcePair {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

/**
 * Generates a random `state` value for CSRF protection on the authorization
 * request (16 random bytes, base64url-encoded).
 */
export function generateState(): string {
  return base64UrlEncode(crypto.randomBytes(16));
}
