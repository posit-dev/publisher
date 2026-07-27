// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  uiKind: 1, // UIKind.Desktop
  remoteName: undefined as string | undefined,
  registerClient: vi.fn(),
  buildAuthorizeUrl: vi.fn(),
  exchangeAuthCode: vi.fn(),
  startDeviceAuth: vi.fn(),
  pollDeviceToken: vi.fn(),
  startLoopbackServer: vi.fn(),
  getCurrentUser: vi.fn(),
  openExternal: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
}));

vi.mock("vscode", () => ({
  env: {
    get uiKind() {
      return h.uiKind;
    },
    get remoteName() {
      return h.remoteName;
    },
    openExternal: (...args: unknown[]) => h.openExternal(...args),
  },
  UIKind: { Desktop: 1, Web: 2 },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
  window: { showInformationMessage: vi.fn(() => Promise.resolve(undefined)) },
}));

vi.mock("src/logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("src/utils/progress", () => ({
  showProgress: (_t: string, _v: string, cb: () => unknown) => cb(),
}));

vi.mock("src/utils/errors", () => ({
  getMessageFromError: (e: unknown) => String(e),
}));

vi.mock("@posit-dev/connect-api", () => ({
  ConnectAPI: class {
    getCurrentUser = h.getCurrentUser;
  },
}));

vi.mock("./client", () => ({
  OAuthClient: class {
    registerClient = h.registerClient;
    buildAuthorizeUrl = h.buildAuthorizeUrl;
    exchangeAuthCode = h.exchangeAuthCode;
    startDeviceAuth = h.startDeviceAuth;
    pollDeviceToken = h.pollDeviceToken;
  },
  tokenExpiresAt: () => "2099-01-01T00:00:00.000Z",
}));

vi.mock("./discovery", () => ({ discoverOAuthMetadata: vi.fn() }));

vi.mock("./loopback", () => ({
  startLoopbackServer: (...args: unknown[]) => h.startLoopbackServer(...args),
}));

vi.mock("./pkce", () => ({
  generatePkcePair: () => ({ verifier: "verifier", challenge: "challenge" }),
  generateState: () => "state-123",
}));

import { ConnectOAuthActivator } from "./activator";
import { OAuthMetadata } from "./types";

const METADATA: OAuthMetadata = {
  issuer: "https://connect.example.com",
  authorization_endpoint: "https://connect.example.com/oauth/v1/authorize",
  token_endpoint: "https://connect.example.com/oauth/v1/token",
  registration_endpoint: "https://connect.example.com/oauth/v1/register",
  device_authorization_endpoint:
    "https://connect.example.com/oauth/v1/device/authorize",
};

function makeActivator(): ConnectOAuthActivator {
  return new ConnectOAuthActivator(
    "https://connect.example.com",
    METADATA,
    "view-id",
    false,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.uiKind = 1;
  h.remoteName = undefined;
  h.registerClient.mockResolvedValue({ client_id: "client-abc" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConnectOAuthActivator redirect selection", () => {
  it("uses loopback on desktop (local)", async () => {
    h.uiKind = 1; // Desktop
    h.remoteName = undefined;
    h.startLoopbackServer.mockResolvedValue({
      redirectUri: "http://127.0.0.1:5000/callback",
      waitForCode: () => Promise.resolve("auth-code"),
      close: vi.fn(),
    });
    h.buildAuthorizeUrl.mockReturnValue(
      "https://connect.example.com/authorize",
    );
    h.exchangeAuthCode.mockResolvedValue({
      access_token: "at",
      token_type: "Bearer",
      refresh_token: "rt",
      expires_in: 3600,
    });
    h.getCurrentUser.mockResolvedValue({ username: "publisher1" });

    const result = await makeActivator().authenticate();

    expect(h.startLoopbackServer).toHaveBeenCalledTimes(1);
    expect(h.startDeviceAuth).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      oauthClientId: "client-abc",
      accessToken: "at",
      refreshToken: "rt",
      userName: "publisher1",
    });
  });

  it("uses the device flow in a web UI (e.g. Positron on Workbench)", async () => {
    h.uiKind = 2; // Web
    h.remoteName = undefined;
    // Sentinel: prove the device path was taken without running the poll loop.
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");

    expect(h.startLoopbackServer).not.toHaveBeenCalled();
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });

  it("auto-opens the verification URL as a raw string before polling (device flow)", async () => {
    vi.useFakeTimers();
    try {
      h.uiKind = 2; // Web
      h.startDeviceAuth.mockResolvedValue({
        device_code: "dc",
        user_code: "WXYZ-1234",
        verification_uri: "https://connect.example.com/device",
        verification_uri_complete:
          "https://connect.example.com/device?user_code=WXYZ-1234",
        expires_in: 600,
        interval: 1,
      });
      h.pollDeviceToken.mockResolvedValue({
        done: true,
        response: {
          access_token: "at",
          token_type: "Bearer",
          refresh_token: "rt",
        },
      });
      h.getCurrentUser.mockResolvedValue({ username: "publisher1" });

      const promise = makeActivator().authenticate();
      await vi.advanceTimersByTimeAsync(1500); // flush pre-poll awaits + 1s sleep
      const result = await promise;

      // Opened automatically (not gated on a button) and as a raw string, not a
      // parsed Uri — the proven Workbench mechanism.
      expect(h.openExternal).toHaveBeenCalledWith(
        "https://connect.example.com/device?user_code=WXYZ-1234",
      );
      expect(h.startLoopbackServer).not.toHaveBeenCalled();
      expect(result.accessToken).toBe("at");
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the device flow when attached to a remote host", async () => {
    h.uiKind = 1; // Desktop UI…
    h.remoteName = "ssh-remote"; // …but the extension host is remote
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");

    expect(h.startLoopbackServer).not.toHaveBeenCalled();
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });
});
