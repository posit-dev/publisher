// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPost = vi.fn();

vi.mock("./httpClient", () => ({
  createOAuthHttpClient: vi.fn(() => ({ post: mockPost })),
  OAUTH_TIMEOUT_MS: 30_000,
}));

import { OAuthClient, OAuthError, tokenExpiresAt } from "./client";
import { OAuthMetadata } from "./types";

const METADATA: OAuthMetadata = {
  issuer: "https://connect.example.com",
  authorization_endpoint: "https://connect.example.com/oauth/v1/authorize",
  token_endpoint: "https://connect.example.com/oauth/v1/token",
  registration_endpoint: "https://connect.example.com/oauth/v1/register",
  device_authorization_endpoint:
    "https://connect.example.com/oauth/v1/device/authorize",
};

function client(): OAuthClient {
  return new OAuthClient(false);
}

/** Parses the URLSearchParams-encoded body of the Nth mockPost call. */
function formBody(callIndex = 0): URLSearchParams {
  const body = mockPost.mock.calls[callIndex]?.[1];
  return new URLSearchParams(String(body));
}

beforeEach(() => {
  mockPost.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerClient", () => {
  it("POSTs client metadata and returns the registration", async () => {
    mockPost.mockResolvedValue({
      status: 201,
      data: { client_id: "client-abc", client_name: "posit-publisher" },
    });

    const reg = await client().registerClient(METADATA, [
      "http://127.0.0.1/callback",
    ]);

    expect(reg.client_id).toBe("client-abc");
    const [url, body] = mockPost.mock.calls[0]!;
    expect(url).toBe(METADATA.registration_endpoint);
    expect(body.client_name).toBe("posit-publisher");
    expect(body.redirect_uris).toEqual(["http://127.0.0.1/callback"]);
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.response_types).toEqual(["code"]);
    expect(body.grant_types).toContain("authorization_code");
    expect(body.grant_types).toContain("refresh_token");
  });

  it("omits the device-code grant when the server does not advertise the device endpoint", async () => {
    mockPost.mockResolvedValue({
      status: 201,
      data: { client_id: "client-abc" },
    });
    const noDevice: OAuthMetadata = {
      ...METADATA,
      device_authorization_endpoint: undefined,
    };

    await client().registerClient(noDevice, ["http://127.0.0.1/callback"]);

    const [, body] = mockPost.mock.calls[0]!;
    expect(body.grant_types).toEqual(["authorization_code", "refresh_token"]);
  });

  it("throws when the server does not advertise registration", async () => {
    const noReg: OAuthMetadata = {
      ...METADATA,
      registration_endpoint: undefined,
    };
    await expect(
      client().registerClient(noReg, ["http://127.0.0.1/callback"]),
    ).rejects.toBeInstanceOf(OAuthError);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("throws an OAuthError carrying the server error code", async () => {
    mockPost.mockResolvedValue({
      status: 400,
      data: {
        error: "invalid_redirect_uri",
        error_description: "Redirect URI not allowed",
      },
    });

    const err = await client()
      .registerClient(METADATA, ["vscode://x"])
      .catch((e) => e);

    expect(err).toBeInstanceOf(OAuthError);
    expect(err.code).toBe("invalid_redirect_uri");
    expect(err.message).toBe("Redirect URI not allowed");
  });
});

describe("buildAuthorizeUrl", () => {
  it("builds an authorize URL with PKCE + state params", () => {
    const url = new URL(
      client().buildAuthorizeUrl(METADATA, {
        clientId: "client-abc",
        redirectUri: "http://127.0.0.1:5000/callback",
        codeChallenge: "challenge-xyz",
        state: "state-123",
      }),
    );

    expect(url.origin + url.pathname).toBe(METADATA.authorization_endpoint);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-abc");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:5000/callback",
    );
    expect(url.searchParams.get("code_challenge")).toBe("challenge-xyz");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("state-123");
  });
});

describe("exchangeAuthCode", () => {
  it("POSTs the authorization_code grant and returns tokens", async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: {
        access_token: "at",
        token_type: "Bearer",
        refresh_token: "rt",
        expires_in: 3600,
      },
    });

    const tokens = await client().exchangeAuthCode(METADATA, {
      code: "the-code",
      codeVerifier: "the-verifier",
      redirectUri: "http://127.0.0.1:5000/callback",
      clientId: "client-abc",
    });

    expect(tokens.access_token).toBe("at");
    const body = formBody();
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toBe("the-verifier");
    expect(body.get("redirect_uri")).toBe("http://127.0.0.1:5000/callback");
    expect(body.get("client_id")).toBe("client-abc");
  });

  it("throws when the token response lacks an access_token", async () => {
    mockPost.mockResolvedValue({
      status: 400,
      data: { error: "invalid_grant" },
    });
    await expect(
      client().exchangeAuthCode(METADATA, {
        code: "x",
        codeVerifier: "y",
        redirectUri: "http://127.0.0.1/callback",
        clientId: "c",
      }),
    ).rejects.toBeInstanceOf(OAuthError);
  });
});

describe("refreshToken", () => {
  it("POSTs the refresh_token grant", async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: { access_token: "at2", token_type: "Bearer", refresh_token: "rt2" },
    });

    const tokens = await client().refreshToken(METADATA, {
      clientId: "client-abc",
      refreshToken: "old-rt",
    });

    expect(tokens.access_token).toBe("at2");
    const body = formBody();
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-rt");
    expect(body.get("client_id")).toBe("client-abc");
  });

  it("throws on refresh failure", async () => {
    mockPost.mockResolvedValue({
      status: 400,
      data: { error: "invalid_grant", error_description: "expired" },
    });
    await expect(
      client().refreshToken(METADATA, {
        clientId: "c",
        refreshToken: "bad",
      }),
    ).rejects.toBeInstanceOf(OAuthError);
  });
});

describe("startDeviceAuth", () => {
  it("returns the device authorization response", async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: {
        device_code: "dc",
        user_code: "WXYZ-1234",
        verification_uri: "https://connect.example.com/device",
        verification_uri_complete:
          "https://connect.example.com/device?user_code=WXYZ-1234",
        expires_in: 600,
        interval: 5,
      },
    });

    const device = await client().startDeviceAuth(METADATA, "client-abc");

    expect(device.user_code).toBe("WXYZ-1234");
    const body = formBody();
    expect(body.get("client_id")).toBe("client-abc");
  });

  it("throws when device flow is unsupported", async () => {
    const noDevice: OAuthMetadata = {
      ...METADATA,
      device_authorization_endpoint: undefined,
    };
    await expect(
      client().startDeviceAuth(noDevice, "c"),
    ).rejects.toBeInstanceOf(OAuthError);
  });
});

describe("pollDeviceToken", () => {
  const params = { clientId: "client-abc", deviceCode: "dc" };

  it("returns done + tokens once issued", async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: { access_token: "at", token_type: "Bearer" },
    });
    const result = await client().pollDeviceToken(METADATA, params);
    expect(result).toEqual({
      done: true,
      response: { access_token: "at", token_type: "Bearer" },
    });
  });

  it("returns not-done for authorization_pending", async () => {
    mockPost.mockResolvedValue({
      status: 400,
      data: { error: "authorization_pending" },
    });
    const result = await client().pollDeviceToken(METADATA, params);
    expect(result).toEqual({ done: false, slowDown: false });
  });

  it("returns slowDown for slow_down", async () => {
    mockPost.mockResolvedValue({
      status: 400,
      data: { error: "slow_down" },
    });
    const result = await client().pollDeviceToken(METADATA, params);
    expect(result).toEqual({ done: false, slowDown: true });
  });

  it("throws on a terminal error such as expired_token", async () => {
    mockPost.mockResolvedValue({
      status: 400,
      data: { error: "expired_token" },
    });
    const err = await client()
      .pollDeviceToken(METADATA, params)
      .catch((e) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect(err.code).toBe("expired_token");
  });
});

describe("tokenExpiresAt", () => {
  it("computes an ISO expiry from expires_in", () => {
    const before = Date.now();
    const iso = tokenExpiresAt({
      access_token: "a",
      token_type: "Bearer",
      expires_in: 3600,
    });
    const ms = new Date(iso).getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 3600 * 1000 - 1000);
    expect(ms).toBeLessThanOrEqual(Date.now() + 3600 * 1000 + 1000);
  });

  it("returns empty string when expires_in is absent", () => {
    expect(tokenExpiresAt({ access_token: "a", token_type: "Bearer" })).toBe(
      "",
    );
  });
});
