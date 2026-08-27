// Copyright (C) 2026 by Posit Software, PBC.

import { env, UIKind, window, workspace } from "vscode";
import { ConnectAPI } from "@posit-dev/connect-api";

import { logger } from "src/logging";
import { describeError, getMessageFromError } from "src/utils/errors";
import { showProgress } from "src/utils/progress";
import { getUserAgent } from "src/utils/userAgent";
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
import {
  detectWorkbench,
  isWorkbenchRelayReachable,
  pollWorkbenchAuthCode,
  workbenchRedirectUri,
  WorkbenchEnvironment,
  WorkbenchRelayError,
} from "./workbench";

/** Result of a successful interactive OAuth sign-in. */
export interface OAuthAuthResult extends OAuthTokens {
  /** The authenticated user's username, if it could be retrieved. */
  userName: string;
}

/** Tokens plus the `client_id` the flow that obtained them registered under. */
interface AuthorizeResult {
  clientId: string;
  tokenResponse: OAuthTokenResponse;
}

export type OAuthTransportUnavailableReason =
  "missingDeviceAuthorizationEndpoint" | "missingRegistrationEndpoint";

/**
 * Raised when Connect metadata deterministically lacks a capability required by
 * the selected OAuth flow.
 *
 * Operational registration, network, authorization, and polling failures retain
 * their original error so callers do not mistake them for compatibility cases.
 */
export class OAuthTransportUnavailableError extends Error {
  constructor(
    public readonly reason: OAuthTransportUnavailableReason = "missingDeviceAuthorizationEndpoint",
  ) {
    super(
      reason === "missingRegistrationEndpoint"
        ? "Posit Connect does not advertise a dynamic client registration endpoint required for OAuth sign-in."
        : "Posit Connect does not advertise an OAuth device authorization endpoint.",
    );
    this.name = "OAuthTransportUnavailableError";
  }
}

// Fallback device poll interval when the server omits `interval` (RFC 8628).
const DEFAULT_DEVICE_POLL_MS = 5_000;
const SLOW_DOWN_INCREMENT_MS = 5_000;

/**
 * Opens a URL in the user's browser, passing the raw string rather than
 * `Uri.parse(url)`. VS Code's `env.openExternal(Uri.parse(...))` mis-encodes
 * nested/redirect query params (e.g. the percent-encoded `redirect_uri` in an
 * OAuth authorize URL) — the same hazard the Connect Cloud flow documents in
 * multiStepHelper, and the same reason Workbench's own VS Code extension passes a
 * string (`rstudio-workbench-vscode-ext` `src/utils/oauthClient.ts`). Passing the
 * string preserves the exact encoding. This routes to the user's browser in
 * desktop, remote, and web hosts alike.
 */
async function openExternalUrl(url: string): Promise<void> {
  // @ts-expect-error env.openExternal is typed for Uri, but the string overload
  // is what preserves nested-redirect encoding (see comment above).
  await env.openExternal(url);
}

function isInvalidRedirectUriError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (
    "code" in error &&
    (error as { code?: unknown }).code === "invalid_redirect_uri"
  ) {
    return true;
  }
  const message = error.message.trim().toLowerCase();
  return (
    message === "invalid redirect_uri" || message === "invalid redirect uri"
  );
}

/**
 * Drives the interactive Connect OAuth sign-in from the credential stepper,
 * mirroring rsconnect-python's login command: discover metadata (if not already
 * provided), register a public client, and run the Authorization Code + PKCE
 * flow, choosing a redirect transport that works in the current environment
 * (see {@link authorize}). Analogous to {@link ConnectAuthTokenActivator}.
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
    const { clientId, tokenResponse } = await this.authorize();

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
   * Chooses a redirect transport for the Authorization Code + PKCE flow and runs
   * it, falling back to the device flow when the browser can't deliver the
   * redirect back to the extension host. In order:
   *
   * 1. `positPublisher.useDeviceCodeAuth` — an explicit user override, honored
   *    first so it always wins.
   * 2. **Posit Workbench** (`RS_SERVER_URL` + `RS_SERVER_ADDRESS` set) — browser
   *    VS Code/Positron. Loopback is unreachable from the user's browser here,
   *    but Workbench relays the code through `/oauth_redirect_callback` +
   *    `/oauth_code?state=`. Requires the Workbench URL to be allowlisted in
   *    Connect's redirect URIs, so registration can fail — fall back to device.
   * 3. **Loopback** (`http://127.0.0.1:<port>/callback`) — only when the
   *    extension host and browser share a machine: a desktop UI with no
   *    `remoteName`. In any web UI or remote setup (Remote-SSH, Codespaces, WSL)
   *    the socket binds fine on the host but the redirect never arrives, so it
   *    would hang until timeout.
   * 4. **Device flow** — the fallback when advertised by Connect.
   *
   * Dynamic client registration is required by every flow. When it is absent,
   * or when the selected flow reaches unadvertised device authorization, throws
   * {@link OAuthTransportUnavailableError}. Other OAuth failures are propagated
   * unchanged.
   */
  private async authorize(): Promise<AuthorizeResult> {
    if (!this.metadata.registration_endpoint) {
      logger.debug(
        "OAuth sign-in is unavailable because Posit Connect did not advertise " +
          "a dynamic client registration endpoint.",
      );
      throw new OAuthTransportUnavailableError("missingRegistrationEndpoint");
    }

    const workbench = detectWorkbench();

    if (this.deviceCodeForced()) {
      this.logTransport(
        "device code",
        "the positPublisher.useDeviceCodeAuth setting is enabled, which " +
          "overrides automatic selection. Turn it off to let Publisher " +
          "redirect back to the editor.",
      );
      return this.deviceCodeFlow();
    }

    if (workbench) {
      this.logTransport(
        "Posit Workbench redirect relay",
        `redirecting through ${workbenchRedirectUri(workbench)}.`,
      );
      const result = await this.tryWorkbenchFlow(workbench);
      if (result) {
        return result;
      }
      return this.deviceCodeFlow();
    }

    if (env.uiKind !== UIKind.Desktop || env.remoteName) {
      this.logTransport(
        "device code",
        "a loopback redirect is unreachable from the browser in this " +
          "environment, and no Posit Workbench session was detected.",
      );
      return this.deviceCodeFlow();
    }

    this.logTransport(
      "loopback",
      "the editor and browser are on the same machine.",
    );
    const result = await this.tryLoopbackFlow();
    if (result) {
      return result;
    }
    return this.deviceCodeFlow();
  }

  /** Announces the chosen transport and, in plain terms, why. */
  private logTransport(transport: string, why: string): void {
    logger.debug(`OAuth sign-in will use the ${transport} flow — ${why}`);
  }

  /**
   * Announces that a transport was abandoned and the device flow will be tried
   * instead. Paired with {@link logTransport} so the log always shows both the
   * transport that was chosen and, if it didn't work out, why it was dropped.
   */
  private logFallback(transport: string, why: string): void {
    logger.debug(
      `OAuth sign-in is falling back from the ${transport} flow to the ` +
        `device code flow — ${why}`,
    );
  }

  /** Whether the user has forced the device-code flow via settings. */
  private deviceCodeForced(): boolean {
    return workspace
      .getConfiguration("positPublisher")
      .get<boolean>("useDeviceCodeAuth", false);
  }

  /**
   * Authorization Code + PKCE through Posit Workbench's OAuth redirect relay,
   * the mechanism Workbench's own VS Code extension uses. Returns `undefined`
   * when the relay is unavailable or Connect rejects the Workbench redirect
   * URI, allowing the caller to apply the device-or-legacy fallback cascade.
   * Terminal failures and unrelated errors are rethrown.
   */
  private async tryWorkbenchFlow(
    workbench: WorkbenchEnvironment,
  ): Promise<AuthorizeResult | undefined> {
    const redirectUri = workbenchRedirectUri(workbench);

    if (!(await isWorkbenchRelayReachable(workbench, this.insecure))) {
      this.logFallback(
        "Posit Workbench redirect relay",
        `the relay did not respond at ${workbench.serverAddress}/oauth_code. ` +
          "Check that RS_SERVER_ADDRESS is reachable from the extension host.",
      );
      return undefined;
    }

    let clientId: string;
    try {
      clientId = await this.register(redirectUri);
    } catch (err) {
      // A rejected Workbench redirect URI means this authorization-code
      // transport is unavailable. Preserve all other registration failures so
      // network, server, and unrelated OAuth errors are not treated as a
      // transport compatibility case.
      if (!isInvalidRedirectUriError(err)) {
        logger.debug(
          `OAuth client registration for the Posit Workbench redirect failed ` +
            `and cannot fall back: ${describeError(err)}`,
        );
        throw err;
      }
      this.logFallback(
        "Posit Workbench redirect relay",
        `Posit Connect did not accept the redirect URI ${redirectUri} ` +
          `(${describeError(err)}). A Connect administrator can add this exact ` +
          "URI to the allowed redirect URIs to enable browser sign-in here.",
      );
      return undefined;
    }

    const { verifier, challenge } = generatePkcePair();
    const state = generateState();

    const authorizeUrl = this.client.buildAuthorizeUrl(this.metadata, {
      clientId,
      redirectUri,
      codeChallenge: challenge,
      state,
    });
    await openExternalUrl(authorizeUrl);

    let code: string;
    try {
      code = await showProgress(
        "Waiting for authorization in your browser…",
        this.viewId,
        () => pollWorkbenchAuthCode(workbench, state, this.insecure),
      );
    } catch (err) {
      if (err instanceof WorkbenchRelayError && !err.terminal) {
        this.logFallback(
          "Posit Workbench redirect relay",
          `the relay failed while waiting for the redirect (${err.message}).`,
        );
        return undefined;
      }
      logger.debug(
        `OAuth sign-in through the Posit Workbench redirect relay failed and ` +
          `cannot fall back: ${describeError(err)}`,
      );
      throw err;
    }

    const tokenResponse = await this.client.exchangeAuthCode(this.metadata, {
      code,
      codeVerifier: verifier,
      redirectUri,
      clientId,
    });
    return { clientId, tokenResponse };
  }

  /**
   * Authorization Code + PKCE over a loopback listener on the extension host.
   * Returns `undefined` when a loopback port can't be bound so the caller can
   * fall back to the device flow.
   */
  private async tryLoopbackFlow(): Promise<AuthorizeResult | undefined> {
    const clientId = await this.register(OAUTH_LOOPBACK_REDIRECT);
    const { verifier, challenge } = generatePkcePair();
    const state = generateState();

    let loopback;
    try {
      loopback = await startLoopbackServer(state);
    } catch (err) {
      this.logFallback(
        "loopback",
        `a listener could not be bound on 127.0.0.1 (${describeError(err)}).`,
      );
      return undefined;
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

      const tokenResponse = await this.client.exchangeAuthCode(this.metadata, {
        code,
        codeVerifier: verifier,
        redirectUri: loopback.redirectUri,
        clientId,
      });
      return { clientId, tokenResponse };
    } finally {
      loopback.close();
    }
  }

  /** Registers a public client for a single redirect URI (RFC 7591). */
  private register(redirectUri: string): Promise<string> {
    return showProgress("Registering with Posit Connect", this.viewId, () =>
      this.client
        .registerClient(this.metadata, [redirectUri])
        .then((registration) => registration.client_id),
    );
  }

  /** RFC 8628 device flow: show the user code, then poll until authorized. */
  private async deviceCodeFlow(): Promise<AuthorizeResult> {
    if (!this.metadata.device_authorization_endpoint) {
      logger.debug(
        "OAuth device-code sign-in is unavailable because Posit Connect did " +
          "not advertise a device authorization endpoint.",
      );
      throw new OAuthTransportUnavailableError(
        "missingDeviceAuthorizationEndpoint",
      );
    }

    // The device flow has no redirect, but Connect's dynamic client registration
    // still requires at least one redirect URI. Register the loopback URI, which
    // Connect always accepts.
    const clientId = await this.register(OAUTH_LOOPBACK_REDIRECT);
    const device = await this.client.startDeviceAuth(this.metadata, clientId);

    const verificationUri =
      device.verification_uri_complete ?? device.verification_uri;

    // Show the user code so it can be visually confirmed against the code on
    // Connect's device page (verification_uri_complete pre-fills it — the user
    // just checks it matches). Non-blocking — the poll below is what waits.
    void window.showInformationMessage(
      `Posit Connect sign-in: confirm the code ${device.user_code} matches the one shown in the browser tab that opened.`,
    );

    // Auto-open the verification page, mirroring
    // ConnectAuthTokenActivator.openTokenClaimUrl — the mechanism proven to work
    // in browser-based Positron on Posit Workbench. Await it before polling so
    // the browser is up first, matching the token-claim flow's ordering.
    await openExternalUrl(verificationUri);

    const tokenResponse = await showProgress(
      `Waiting for device authorization (code ${device.user_code})…`,
      this.viewId,
      () => this.pollDeviceToken(clientId, device),
    );
    return { clientId, tokenResponse };
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
        userAgent: getUserAgent(),
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
