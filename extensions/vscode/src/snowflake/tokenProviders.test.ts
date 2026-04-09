// Copyright (C) 2026 by Posit Software, PBC.

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios");
import axios from "axios";

import { createTokenProvider } from "./tokenProviders";

describe("createTokenProvider", () => {
  it("throws for unsupported authenticator type", () => {
    expect(() =>
      createTokenProvider({
        account: "myaccount",
        user: "myuser",
        authenticator: "unsupported",
      }),
    ).toThrow('unsupported authenticator type: "unsupported"');
  });
});

describe("JWT token provider (snowflake_jwt)", () => {
  let tmpDir: string;
  let privateKeyFile: string;
  let privateKeyPem: string;
  let publicKeyDer: Buffer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowflake-jwt-test-"));

    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    privateKeyPem = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    publicKeyDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;

    privateKeyFile = path.join(tmpDir, "key.p8");
    fs.writeFileSync(privateKeyFile, privateKeyPem, "utf-8");

    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("generates a JWT with correct claims structure and POSTs to token endpoint", async () => {
    const mockPost = vi.mocked(axios.post).mockResolvedValue({
      data: "access-token-value",
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "snowflake_jwt",
      private_key_file: privateKeyFile,
    });

    const token = await provider.getToken("example.snowflakecomputing.app");

    expect(token).toBe("access-token-value");
    expect(mockPost).toHaveBeenCalledOnce();

    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe("https://myaccount.snowflakecomputing.com/oauth/token");
    expect(config).toMatchObject({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Parse URLSearchParams from the body
    const params = new URLSearchParams(body as string);
    expect(params.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    expect(params.get("scope")).toBe("example.snowflakecomputing.app");

    // Decode and verify the JWT assertion
    const assertion = params.get("assertion");
    expect(assertion).toBeTruthy();

    const decoded = JSON.parse(
      Buffer.from(assertion!.split(".")[1], "base64url").toString("utf-8"),
    );
    const header = JSON.parse(
      Buffer.from(assertion!.split(".")[0], "base64url").toString("utf-8"),
    );

    expect(header.alg).toBe("RS256");
    expect(decoded.sub).toBe("MYACCOUNT.MYUSER");

    // Verify fingerprint
    const expectedFingerprint = crypto
      .createHash("sha256")
      .update(publicKeyDer)
      .digest("base64");
    expect(decoded.iss).toBe(`MYACCOUNT.MYUSER.SHA256:${expectedFingerprint}`);

    // Verify exp - iat = 60
    expect(decoded.exp - decoded.iat).toBe(60);
  });

  it("includes role in scope when specified", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: "token" });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "snowflake_jwt",
      private_key_file: privateKeyFile,
      role: "myrole",
    });

    await provider.getToken("example.snowflakecomputing.app");

    const [, body] = vi.mocked(axios.post).mock.calls[0];
    const params = new URLSearchParams(body as string);
    expect(params.get("scope")).toBe(
      "session:role:myrole example.snowflakecomputing.app",
    );
  });

  it("throws when private key file does not exist", () => {
    expect(() =>
      createTokenProvider({
        account: "myaccount",
        user: "myuser",
        authenticator: "snowflake_jwt",
        private_key_file: path.join(tmpDir, "nonexistent.p8"),
      }),
    ).toThrow();
  });

  it("throws when private key file is malformed", () => {
    const badKeyFile = path.join(tmpDir, "bad.p8");
    fs.writeFileSync(badKeyFile, "this is not a valid PEM key", "utf-8");

    expect(() =>
      createTokenProvider({
        account: "myaccount",
        user: "myuser",
        authenticator: "snowflake_jwt",
        private_key_file: badKeyFile,
      }),
    ).toThrow();
  });

  it("returns the access token from the exchange response", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: "my-special-access-token",
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "snowflake_jwt",
      private_key_file: privateKeyFile,
    });

    const token = await provider.getToken("example.snowflakecomputing.app");
    expect(token).toBe("my-special-access-token");
  });
});

describe("OAuth token provider (oauth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends login-request with correct body and headers", async () => {
    const mockPost = vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {
          token: "session-token-value",
        },
      },
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    await provider.getToken("example.snowflakecomputing.app");

    expect(mockPost).toHaveBeenCalledOnce();

    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe(
      "https://myaccount.snowflakecomputing.com/session/v1/login-request",
    );
    expect(body).toEqual({
      data: {
        ACCOUNT_NAME: "myaccount",
        TOKEN: "my-oauth-token",
        AUTHENTICATOR: "OAUTH",
      },
    });
    expect(config).toMatchObject({
      headers: {
        "Content-Type": "application/json",
        Accept: "application/snowflake",
      },
    });
  });

  it("returns the session token from data.data.token", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {
          token: "my-session-token",
        },
      },
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    const result = await provider.getToken("example.snowflakecomputing.app");
    expect(result).toBe("my-session-token");
  });

  it("throws when login response is missing token", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: {},
      },
    });

    const provider = createTokenProvider({
      account: "myaccount",
      user: "myuser",
      authenticator: "oauth",
      token: "my-oauth-token",
    });

    await expect(
      provider.getToken("example.snowflakecomputing.app"),
    ).rejects.toThrow("missing token in login response");
  });
});
