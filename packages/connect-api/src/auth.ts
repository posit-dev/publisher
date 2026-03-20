// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";

/**
 * Computes the base64-encoded MD5 checksum of the given data.
 * For empty/undefined body, computes the checksum of an empty string.
 */
export function md5Checksum(body: string | undefined): string {
  const data = body ?? "";
  const hash = crypto.createHash("md5").update(data).digest();
  return hash.toString("base64");
}

/**
 * Builds the canonical request string used for token auth signing.
 * Format: "METHOD\nPATH\nDATE\nCHECKSUM"
 */
export function buildCanonicalRequest(
  method: string,
  path: string,
  date: string,
  checksum: string,
): string {
  return `${method}\n${path}\n${date}\n${checksum}`;
}

/**
 * Signs the canonical request string using RSA-SHA1 with the given
 * base64-encoded DER PKCS#1 private key.
 * Returns the base64-encoded signature.
 */
export function rsaSha1Sign(
  canonicalRequest: string,
  privateKeyBase64: string,
): string {
  const derBuffer = Buffer.from(privateKeyBase64, "base64");
  const privateKey = crypto.createPrivateKey({
    key: derBuffer,
    format: "der",
    type: "pkcs1",
  });
  const signer = crypto.createSign("SHA1");
  signer.update(canonicalRequest);
  return signer.sign(privateKey, "base64");
}

/**
 * Computes per-request authentication headers for Connect token auth.
 * Returns an object with Date, X-Content-Checksum, X-Auth-Token, and X-Auth-Signature headers.
 */
export function signRequest(
  method: string,
  path: string,
  body: string | undefined,
  token: string,
  privateKeyBase64: string,
): Record<string, string> {
  const date = new Date().toUTCString();
  const checksum = md5Checksum(body);
  const canonical = buildCanonicalRequest(method, path, date, checksum);
  const signature = rsaSha1Sign(canonical, privateKeyBase64);

  return {
    Date: date,
    "X-Content-Checksum": checksum,
    "X-Auth-Token": token,
    "X-Auth-Signature": signature,
  };
}
