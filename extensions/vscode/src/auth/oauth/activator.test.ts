// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  uiKind: 1, // UIKind.Desktop
  remoteName: undefined as string | undefined,
  forceDeviceCode: false,
  registerClient: vi.fn(),
  buildAuthorizeUrl: vi.fn(),
  exchangeAuthCode: vi.fn(),
  startDeviceAuth: vi.fn(),
  pollDeviceToken: vi.fn(),
  startLoopbackServer: vi.fn(),
  detectWorkbench: vi.fn(),
  isWorkbenchRelayReachable: vi.fn(),
  pollWorkbenchAuthCode: vi.fn(),
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
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, _def?: unknown) => h.forceDeviceCode,
    }),
  },
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

vi.mock("./workbench", async () => {
  // Keep the real WorkbenchRelayError so `instanceof` narrowing in the activator
  // is exercised, and the real redirect-URI builder (pure string math).
  const actual =
    await vi.importActual<typeof import("./workbench")>("./workbench");
  return {
    ...actual,
    detectWorkbench: (...args: unknown[]) => h.detectWorkbench(...args),
    isWorkbenchRelayReachable: (...args: unknown[]) =>
      h.isWorkbenchRelayReachable(...args),
    pollWorkbenchAuthCode: (...args: unknown[]) =>
      h.pollWorkbenchAuthCode(...args),
  };
});

import { ConnectOAuthActivator } from "./activator";
import { OAuthMetadata } from "./types";
import { WorkbenchRelayError } from "./workbench";

const METADATA: OAuthMetadata = {
  issuer: "https://connect.example.com",
  authorization_endpoint: "https://connect.example.com/oauth/v1/authorize",
  token_endpoint: "https://connect.example.com/oauth/v1/token",
  registration_endpoint: "https://connect.example.com/oauth/v1/register",
  device_authorization_endpoint:
    "https://connect.example.com/oauth/v1/device/authorize",
};

const WORKBENCH = {
  externalServerUrl: "https://workbench.example.com",
  serverAddress: "http://localhost:8787",
};

const TOKENS = {
  access_token: "at",
  token_type: "Bearer",
  refresh_token: "rt",
  expires_in: 3600,
};

function makeActivator(): ConnectOAuthActivator {
  return new ConnectOAuthActivator(
    "https://connect.example.com",
    METADATA,
    "view-id",
    false,
  );
}

/** Makes the loopback transport succeed end to end. */
function stubLoopbackSuccess(): void {
  h.startLoopbackServer.mockResolvedValue({
    redirectUri: "http://127.0.0.1:5000/callback",
    waitForCode: () => Promise.resolve("auth-code"),
    close: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.uiKind = 1;
  h.remoteName = undefined;
  h.forceDeviceCode = false;
  h.registerClient.mockResolvedValue({ client_id: "client-abc" });
  h.buildAuthorizeUrl.mockReturnValue("https://connect.example.com/authorize");
  h.exchangeAuthCode.mockResolvedValue(TOKENS);
  h.getCurrentUser.mockResolvedValue({ username: "publisher1" });
  // Not in Workbench unless a test says so.
  h.detectWorkbench.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConnectOAuthActivator transport selection", () => {
  it("uses loopback on desktop (local)", async () => {
    stubLoopbackSuccess();

    const result = await makeActivator().authenticate();

    expect(h.startLoopbackServer).toHaveBeenCalledTimes(1);
    expect(h.startDeviceAuth).not.toHaveBeenCalled();
    // Loopback registers the port-less loopback redirect; Connect matches it
    // against the ephemeral port per RFC 8252.
    expect(h.registerClient).toHaveBeenCalledWith(METADATA, [
      "http://127.0.0.1/callback",
    ]);
    expect(result).toMatchObject({
      oauthClientId: "client-abc",
      accessToken: "at",
      refreshToken: "rt",
      userName: "publisher1",
    });
  });

  it("falls back to the device flow when the loopback listener can't bind", async () => {
    h.startLoopbackServer.mockRejectedValue(new Error("EADDRINUSE"));
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });

  it("uses the device flow in a web UI outside Workbench", async () => {
    h.uiKind = 2; // Web
    // Sentinel: prove the device path was taken without running the poll loop.
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");

    expect(h.startLoopbackServer).not.toHaveBeenCalled();
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });

  it("uses the device flow when attached to a remote host", async () => {
    h.uiKind = 1; // Desktop UI…
    h.remoteName = "ssh-remote"; // …but the extension host is remote
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");

    expect(h.startLoopbackServer).not.toHaveBeenCalled();
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });

  it("uses the device flow when useDeviceCodeAuth is enabled, even in Workbench", async () => {
    h.forceDeviceCode = true;
    h.detectWorkbench.mockReturnValue(WORKBENCH);
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");

    expect(h.startLoopbackServer).not.toHaveBeenCalled();
    expect(h.isWorkbenchRelayReachable).not.toHaveBeenCalled();
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });
});

describe("ConnectOAuthActivator Posit Workbench flow", () => {
  beforeEach(() => {
    // Browser-served VS Code/Positron on Workbench.
    h.uiKind = 2;
    h.detectWorkbench.mockReturnValue(WORKBENCH);
    h.isWorkbenchRelayReachable.mockResolvedValue(true);
    h.pollWorkbenchAuthCode.mockResolvedValue("auth-code");
  });

  it("runs auth code + PKCE through the Workbench redirect relay", async () => {
    const result = await makeActivator().authenticate();

    const redirectUri = "https://workbench.example.com/oauth_redirect_callback";
    expect(h.registerClient).toHaveBeenCalledWith(METADATA, [redirectUri]);
    expect(h.buildAuthorizeUrl).toHaveBeenCalledWith(METADATA, {
      clientId: "client-abc",
      redirectUri,
      codeChallenge: "challenge",
      state: "state-123",
    });
    // Opened as a raw string so the percent-encoded redirect_uri survives.
    expect(h.openExternal).toHaveBeenCalledWith(
      "https://connect.example.com/authorize",
    );
    expect(h.pollWorkbenchAuthCode).toHaveBeenCalledWith(
      WORKBENCH,
      "state-123",
      false,
    );
    expect(h.exchangeAuthCode).toHaveBeenCalledWith(METADATA, {
      code: "auth-code",
      codeVerifier: "verifier",
      redirectUri,
      clientId: "client-abc",
    });
    expect(h.startDeviceAuth).not.toHaveBeenCalled();
    expect(h.startLoopbackServer).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      oauthClientId: "client-abc",
      accessToken: "at",
      userName: "publisher1",
    });
  });

  it("falls back to the device flow when the relay is unreachable", async () => {
    h.isWorkbenchRelayReachable.mockResolvedValue(false);
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");

    // No browser was sent anywhere before the fallback.
    expect(h.openExternal).not.toHaveBeenCalled();
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });

  it("falls back to the device flow when Connect rejects the Workbench redirect URI", async () => {
    // Connect only accepts non-loopback redirect URIs an administrator has
    // allowlisted, so registration is where an unlisted Workbench URL fails.
    h.registerClient.mockRejectedValueOnce(new Error("invalid redirect_uri"));
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");

    expect(h.openExternal).not.toHaveBeenCalled();
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
    // The device flow re-registers under the loopback URI Connect always allows.
    expect(h.registerClient).toHaveBeenLastCalledWith(METADATA, [
      "http://127.0.0.1/callback",
    ]);
  });

  it("falls back to the device flow on a non-terminal relay failure", async () => {
    h.pollWorkbenchAuthCode.mockRejectedValue(
      new WorkbenchRelayError("unexpected status (500)", false),
    );
    h.startDeviceAuth.mockRejectedValue(new Error("DEVICE_PATH"));

    await expect(makeActivator().authenticate()).rejects.toThrow("DEVICE_PATH");
    expect(h.startDeviceAuth).toHaveBeenCalledTimes(1);
  });

  it("surfaces a terminal relay failure instead of retrying elsewhere", async () => {
    h.pollWorkbenchAuthCode.mockRejectedValue(
      new WorkbenchRelayError("Authorization was denied.", true),
    );

    await expect(makeActivator().authenticate()).rejects.toThrow(
      "Authorization was denied.",
    );
    expect(h.startDeviceAuth).not.toHaveBeenCalled();
  });
});

describe("ConnectOAuthActivator device flow", () => {
  it("auto-opens the verification URL as a raw string before polling", async () => {
    vi.useFakeTimers();
    try {
      h.uiKind = 2; // Web, not Workbench → device flow
      h.startDeviceAuth.mockResolvedValue({
        device_code: "dc",
        user_code: "WXYZ-1234",
        verification_uri: "https://connect.example.com/device",
        verification_uri_complete:
          "https://connect.example.com/device?user_code=WXYZ-1234",
        expires_in: 600,
        interval: 1,
      });
      h.pollDeviceToken.mockResolvedValue({ done: true, response: TOKENS });

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
      expect(result.oauthClientId).toBe("client-abc");
    } finally {
      vi.useRealTimers();
    }
  });
});
