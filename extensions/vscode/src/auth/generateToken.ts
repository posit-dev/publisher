// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import { ConnectAPI } from "@posit-dev/connect-api";
import { discoverServerURL } from "src/utils/url";
import { logger } from "src/logging";

/**
 * Generates a random token ID matching Connect's format:
 * "T" prefix + 16 random bytes as hex (33 characters total).
 */
export function generateTokenId(): string {
  return "T" + crypto.randomBytes(16).toString("hex");
}

/**
 * Generates an RSA 2048-bit key pair and returns both keys
 * as base64-encoded DER buffers.
 *
 * - Private key: PKCS#1 DER format (matches Go's x509.MarshalPKCS1PrivateKey)
 * - Public key: SPKI DER format (matches Go's x509.MarshalPKIXPublicKey)
 */
export function generateKeyPair(): {
  privateKey: string;
  publicKey: string;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "der" },
    publicKeyEncoding: { type: "spki", format: "der" },
  });

  return {
    privateKey: privateKey.toString("base64"),
    publicKey: publicKey.toString("base64"),
  };
}

export interface GenerateTokenResult {
  token: string;
  claimUrl: string;
  privateKey: string;
  serverUrl: string;
}

/**
 * Generates a new authentication token for Posit Connect.
 *
 * 1. Creates an RSA 2048-bit key pair and random token ID
 * 2. Discovers the correct server URL by trying POST /__api__/tokens
 *    on candidate URLs (longest path first)
 * 3. Returns the token, claim URL, private key, and discovered server URL
 *
 * @param serverUrl - The Connect server URL (may include extra path segments)
 * @param insecure - When true, skip TLS certificate verification
 */
export async function generateToken(
  serverUrl: string,
  insecure?: boolean,
): Promise<GenerateTokenResult> {
  const tokenId = generateTokenId();
  const { privateKey, publicKey } = generateKeyPair();

  let claimUrl = "";

  const tester = async (urlToTest: string): Promise<void> => {
    const client = new ConnectAPI({
      url: urlToTest,
      rejectUnauthorized: insecure ? false : undefined,
    });

    const response = await client.registerToken(tokenId, publicKey);
    claimUrl = response.token_claim_url;
  };

  const discovery = await discoverServerURL(serverUrl, tester);

  if (discovery.error !== undefined) {
    throw discovery.error instanceof Error
      ? discovery.error
      : new Error(String(discovery.error));
  }

  if (discovery.url !== serverUrl) {
    logger.info(
      `Using discovered server URL: provided=${serverUrl}, discovered=${discovery.url}`,
    );
  }

  return {
    token: tokenId,
    claimUrl,
    privateKey,
    serverUrl: discovery.url,
  };
}
