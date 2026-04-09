// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import fs from "fs";

import axios from "axios";
import jwt from "jsonwebtoken";

import type { SnowflakeConnectionConfig } from "./types";

/** A token provider that returns an ingress access token for a given hostname. */
export interface TokenProvider {
  getToken(hostname: string): Promise<string>;
}

/**
 * Creates a TokenProvider based on the authenticator field of the connection config.
 * Supported authenticators: "snowflake_jwt", "oauth" (case-insensitive).
 */
export function createTokenProvider(
  connection: SnowflakeConnectionConfig,
): TokenProvider {
  const authenticator = connection.authenticator.toLowerCase();

  switch (authenticator) {
    case "snowflake_jwt":
      return new JWTTokenProvider(connection);
    case "oauth":
      return new OAuthTokenProvider(connection);
    default:
      throw new Error(
        `unsupported authenticator type: "${connection.authenticator}"`,
      );
  }
}

/**
 * JWT token provider that uses key-pair authentication.
 * Loads a PKCS8 RSA private key, generates a signed JWT, and exchanges
 * it for an OAuth access token from Snowflake.
 */
class JWTTokenProvider implements TokenProvider {
  private readonly account: string;
  private readonly user: string;
  private readonly privateKeyPem: string;
  private readonly publicKeyDer: Buffer;
  private readonly role: string;

  constructor(connection: SnowflakeConnectionConfig) {
    const keyFile = connection.private_key_file;
    if (!keyFile) {
      throw new Error("private_key_file is required for snowflake_jwt");
    }

    const pemData = fs.readFileSync(keyFile, "utf-8");
    const privateKey = crypto.createPrivateKey(pemData);
    const publicKey = crypto.createPublicKey(privateKey);

    this.account = connection.account;
    this.user = connection.user;
    this.privateKeyPem = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    this.publicKeyDer = publicKey.export({
      type: "spki",
      format: "der",
    }) as Buffer;
    this.role = connection.role ?? "";
  }

  async getToken(hostname: string): Promise<string> {
    const assertion = this.buildJWT();
    return this.exchangeForAccessToken(hostname, assertion);
  }

  private buildJWT(): string {
    const fingerprint = crypto
      .createHash("sha256")
      .update(this.publicKeyDer)
      .digest("base64");

    const sub = `${this.account}.${this.user}`.toUpperCase();
    const iss = `${sub}.SHA256:${fingerprint}`;

    const now = Math.floor(Date.now() / 1000);

    return jwt.sign({ sub, iss, iat: now, exp: now + 60 }, this.privateKeyPem, {
      algorithm: "RS256",
    });
  }

  private async exchangeForAccessToken(
    hostname: string,
    assertion: string,
  ): Promise<string> {
    const scope =
      this.role !== "" ? `session:role:${this.role} ${hostname}` : hostname;

    const params = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      scope,
      assertion,
    });

    const tokenEndpoint = `https://${this.account}.snowflakecomputing.com/oauth/token`;

    const resp = await axios.post(tokenEndpoint, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return resp.data as string;
  }
}

/**
 * OAuth token provider that uses Snowflake's login-request flow.
 * Sends a login request with an OAuth token and retrieves a session token.
 */
class OAuthTokenProvider implements TokenProvider {
  private readonly account: string;
  private readonly token: string;

  constructor(connection: SnowflakeConnectionConfig) {
    this.account = connection.account;
    this.token = connection.token ?? "";
  }

  async getToken(_hostname: string): Promise<string> {
    const loginEndpoint = `https://${this.account}.snowflakecomputing.com/session/v1/login-request`;

    const resp = await axios.post(
      loginEndpoint,
      {
        data: {
          ACCOUNT_NAME: this.account,
          TOKEN: this.token,
          AUTHENTICATOR: "OAUTH",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/snowflake",
        },
      },
    );

    const sessionToken: unknown =
      resp.data &&
      typeof resp.data === "object" &&
      "data" in resp.data &&
      resp.data.data &&
      typeof resp.data.data === "object" &&
      "token" in resp.data.data
        ? resp.data.data.token
        : undefined;

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new Error("missing token in login response");
    }

    return sessionToken;
  }
}
