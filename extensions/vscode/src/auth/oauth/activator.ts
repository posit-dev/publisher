// Copyright (C) 2026 by Posit Software, PBC.

import { env, UIKind, window } from "vscode";
import { ConnectAPI } from "@posit-dev/connect-api";

import { logger } from "src/logging";
import { getMessageFromError } from "src/utils/errors";
import { showProgress } from "src/utils/progress";
import { OAuthClient, tokenExpiresAt } from "./client";
import { discoverOAuthMetadata } from "./discovery";
import { startLoopbackServer } from "./loopback";
import { generatePkcePair, generateState } from "./pkce";
import {
  DeviceAuthResponse,
  OAuthMetadata,
  OAuthTokenResponse,
  OAuthTokens,
  OAUTH_LOOPBACK_REDIRECT,
} from "./types";

/** Result of a successful interactive OAuth sign-in. */
export interface OAuthAuthResult extends OAuthTokens {
  /** The authenticated user's username, if it could be retrieved. */
  userName: string;
}

// Fallback device poll interval when the server omits `interval` (RFC 8628).
const DEFAULT_DEVICE_POLL_MS = 5_000;
const SLOW_DOWN_INCREMENT_MS = 5_000;

/**
 * Opens a URL in the user's browser, passing the raw string rather than
 * `Uri.parse(url)`. VS Code's `env.openExternal(Uri.parse(...))` mis-encodes
 * nested/redirect query params (e.g. the percent-encoded `redirect_uri` in an
 * OAuth authorize URL) — the same hazard the Connect Cloud flow documents in
 * multiStepHelper. Passing the string preserves the exact encoding. This routes
 * to the user's browser in desktop, remote, and web hosts alike, which is why
 * the device flow (browser Positron on Workbench) can rely on it — mirroring
 * ConnectAuthTokenActivator.openTokenClaimUrl, the flow proven to work there.
 */
async function openExternalUrl(url: string): Promise<void> {
  // @ts-expect-error env.openExternal is typed for Uri, but the string overload
  // is what preserves nested-redirect encoding (see comment above).
  await env.openExternal(url);
}

/**
 * Drives the interactive Connect OAuth sign-in from the credential stepper,
 * mirroring rsconnect-python's login command: discover metadata (if not already
 * provided), register a public client, run the Authorization Code + PKCE flow
 * over a loopback listener, and fall back to the device flow when a loopback
 * port can't be bound. Analogous to {@link ConnectAuthTokenActivator}.
 */
export class ConnectOAuthActivator {
  private readonly client: OAuthClient;

  constructor(
    private readonly serverUrl: string,
    private readonly metadata: OAuthMetadata,
    private readonly viewId: string,
    private readonly insecure: boolean,
  ) {
    this.client = new OAuthClient(insecure);
  }

  /**
   * Convenience: probe a server for OAuth metadata and build an activator, or
   * return `undefined` when the server does not support OAuth.
   */
  static async forServer(
    serverUrl: string,
    viewId: string,
    insecure: boolean,
  ): Promise<ConnectOAuthActivator | undefined> {
    const metadata = await discoverOAuthMetadata(serverUrl, insecure);
    if (!metadata) {
      return undefined;
    }
    return new ConnectOAuthActivator(serverUrl, metadata, viewId, insecure);
  }

  /** Runs the full sign-in flow and returns tokens for a new OAuth credential. */
  async authenticate(): Promise<OAuthAuthResult> {
    const registration = await showProgress(
      "Registering with Posit Connect",
      this.viewId,
      () =>
        this.client.registerClient(this.metadata, [OAUTH_LOOPBACK_REDIRECT]),
    );
    const clientId = registration.client_id;

    const tokenResponse = await this.authorize(clientId);

    const tokens: OAuthTokens = {
      oauthClientId: clientId,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? "",
      tokenExpiresAt: tokenExpiresAt(tokenResponse),
    };

    const userName = await this.resolveUserName(tokens.accessToken);
    return { ...tokens, userName };
  }

  /**
   * A loopback redirect only works when the extension host and the user's
   * browser are on the same machine. In a web UI (e.g. Positron served by Posit
   * Workbench in a browser) or a remote setup (Remote-SSH, Codespaces, WSL), the
   * browser cannot reach `127.0.0.1` on the extension host — the loopback socket
   * binds fine on the server but the redirect never arrives, so it would hang
   * until timeout. Detect those environments up front and use the device flow.
   */
  private isLoopbackViable(): boolean {
    return env.uiKind === UIKind.Desktop && !env.remoteName;
  }

  /**
   * Runs the Authorization Code + PKCE flow over loopback, falling back to the
   * device flow in web/remote environments (where loopback is unreachable) or
   * when the loopback listener can't start.
   */
  private async authorize(clientId: string): Promise<OAuthTokenResponse> {
    if (!this.isLoopbackViable()) {
      logger.info(
        "Loopback redirect is not usable in this environment " +
          `(uiKind=${env.uiKind === UIKind.Web ? "web" : "desktop"}, ` +
          `remote=${env.remoteName ?? "none"}); using the OAuth device flow.`,
      );
      return this.authorizeWithDeviceCode(clientId);
    }

    const { verifier, challenge } = generatePkcePair();
    const state = generateState();

    let loopback;
    try {
      loopback = await startLoopbackServer(state);
    } catch (err) {
      logger.info(
        `Loopback listener unavailable (${getMessageFromError(err)}); ` +
          "falling back to OAuth device flow.",
      );
      return this.authorizeWithDeviceCode(clientId);
    }

    try {
      const authorizeUrl = this.client.buildAuthorizeUrl(this.metadata, {
        clientId,
        redirectUri: loopback.redirectUri,
        codeChallenge: challenge,
        state,
      });
      await openExternalUrl(authorizeUrl);

      const code = await showProgress(
        "Waiting for authorization in your browser…",
        this.viewId,
        () => loopback.waitForCode(),
      );

      return await this.client.exchangeAuthCode(this.metadata, {
        code,
        codeVerifier: verifier,
        redirectUri: loopback.redirectUri,
        clientId,
      });
    } finally {
      loopback.close();
    }
  }

  /** RFC 8628 device flow: show the user code, then poll until authorized. */
  private async authorizeWithDeviceCode(
    clientId: string,
  ): Promise<OAuthTokenResponse> {
    const device = await this.client.startDeviceAuth(this.metadata, clientId);

    const verificationUri =
      device.verification_uri_complete ?? device.verification_uri;

    // Surface the user code (verification_uri_complete usually pre-fills it, but
    // show it in case it must be entered manually) with a one-click copy.
    // Non-blocking — the poll below is what waits.
    void window
      .showInformationMessage(
        `Posit Connect sign-in: enter code ${device.user_code} in the browser tab that opened (${device.verification_uri}).`,
        "Copy Code",
      )
      .then((choice) => {
        if (choice === "Copy Code") {
          return env.clipboard.writeText(device.user_code);
        }
        return undefined;
      });

    // Auto-open the verification page, mirroring
    // ConnectAuthTokenActivator.openTokenClaimUrl — the mechanism proven to work
    // in browser-based Positron on Posit Workbench. Await it before polling so
    // the browser is up first, matching the token-claim flow's ordering.
    await openExternalUrl(verificationUri);

    return showProgress(
      `Waiting for device authorization (code ${device.user_code})…`,
      this.viewId,
      () => this.pollDeviceToken(clientId, device),
    );
  }

  private async pollDeviceToken(
    clientId: string,
    device: DeviceAuthResponse,
  ): Promise<OAuthTokenResponse> {
    let interval = (device.interval ?? 5) * 1000 || DEFAULT_DEVICE_POLL_MS;
    const deadline = Date.now() + device.expires_in * 1000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      const result = await this.client.pollDeviceToken(this.metadata, {
        clientId,
        deviceCode: device.device_code,
      });
      if (result.done) {
        return result.response;
      }
      if (result.slowDown) {
        interval += SLOW_DOWN_INCREMENT_MS;
      }
    }

    throw new Error("Device authorization timed out.");
  }

  /**
   * Best-effort lookup of the authenticated username via the bearer token, used
   * to suggest a credential name. Never throws — returns "" on failure.
   */
  private async resolveUserName(accessToken: string): Promise<string> {
    try {
      const api = new ConnectAPI({
        url: this.serverUrl,
        accessToken,
        rejectUnauthorized: this.insecure ? false : undefined,
      });
      const user = await api.getCurrentUser();
      return user.username;
    } catch (err) {
      logger.debug(
        `Could not resolve OAuth user name: ${getMessageFromError(err)}`,
      );
      return "";
    }
  }
}
