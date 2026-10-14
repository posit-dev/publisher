// Copyright (C) 2025 by Posit Software, PBC.

import {
  authentication,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationProviderSessionOptions,
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  commands,
  Disposable,
  Event,
  EventEmitter,
  window,
  workspace,
} from "vscode";
import { Credential } from "./api";
import { ServerType } from "./api/types/contentRecords";
import { Commands } from "./constants";
import { isAccessTokenExpiring } from "./credentials/service";
import { logger } from "./logging";
import { PublisherState } from "./state";
import { getSummaryStringFromError } from "./utils/errors";
import type { AddCredentialOutcome } from "./views/homeView";

// AuthenticationProvider identifiers. The main identifier is exposed to other
// extensions for lookup purposes, while the "label" controls what is shown in
// the Accounts UI next to each entry.
//
// Note: must be kept in sync with contributes.authentication in package.json.
const CONNECT_AUTH_PROVIDER_ID = "posit-connect";
const CONNECT_AUTH_PROVIDER_LABEL = "Posit Connect";

// Every session carries this scope, plus one of the AUTH_SCHEME_* scopes that
// tells the consumer which Authorization header scheme the accessToken needs:
// API keys are sent as `Authorization: Key <token>`, OAuth access tokens as
// `Authorization: Bearer <token>`.
const PUBLISHER_SCOPE = "Publisher";
export const AUTH_SCHEME_KEY = "auth-scheme:Key";
export const AUTH_SCHEME_BEARER = "auth-scheme:Bearer";

// After a failed OAuth refresh (offline, revoked, ...), don't retry for the
// same credential for this long; getSessions() is called often.
const REFRESH_RETRY_BACKOFF_MS = 60_000;

/**
 * Maps a credential to an authentication session, or undefined when the
 * credential has no static token another extension could use:
 *
 * - Connect Cloud and Snowflake credentials target a different API (or need
 *   extra headers), so they are not Connect sessions.
 * - Token + private key credentials sign each request; there is nothing to
 *   hand out.
 */
export function sessionFromCredential(
  credential: Credential,
): AuthenticationSession | undefined {
  if (credential.serverType !== ServerType.CONNECT) {
    return undefined;
  }
  let accessToken: string;
  let scheme: string;
  if (credential.oauthClientId && credential.accessToken) {
    accessToken = credential.accessToken;
    scheme = AUTH_SCHEME_BEARER;
  } else if (credential.apiKey) {
    accessToken = credential.apiKey;
    scheme = AUTH_SCHEME_KEY;
  } else {
    return undefined;
  }
  const account: AuthenticationSessionAccountInformation = {
    id: credential.url,
    label: credential.name,
  };
  return {
    id: credential.guid,
    account,
    accessToken,
    scopes: [PUBLISHER_SCOPE, scheme],
  };
}

function isUrlScope(scope: string): boolean {
  return /^https?:\/\//i.test(scope);
}

// Compares server URLs the same way PublisherState matches credentials to
// deployments: case-insensitive, ignoring a trailing slash.
function sameServer(a: string, b: string): boolean {
  const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

// An unknown expiry counts as not expiring; the consumer will get a 401 and
// can ask again.
function isTokenExpiring(credential: Credential, now: number): boolean {
  return (
    !!credential.oauthClientId &&
    !!credential.refreshToken &&
    isAccessTokenExpiring(credential.tokenExpiresAt, now)
  );
}

function sessionsDiffer(
  a: AuthenticationSession,
  b: AuthenticationSession,
): boolean {
  return (
    a.account.id !== b.account.id ||
    a.account.label !== b.account.label ||
    a.accessToken !== b.accessToken ||
    a.scopes.join(" ") !== b.scopes.join(" ")
  );
}

export class PublisherAuthProvider
  implements AuthenticationProvider, Disposable
{
  private disposable: Disposable;
  private emitter =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();

  // Set on the first request, so that credentials are loaded even if the
  // Publisher Home view (which normally loads them) was never opened.
  private initialLoad: Promise<void> | undefined;

  private lastRefreshFailure = new Map<string, number>();

  constructor(private readonly state: PublisherState) {
    this.disposable = Disposable.from(
      authentication.registerAuthenticationProvider(
        CONNECT_AUTH_PROVIDER_ID,
        CONNECT_AUTH_PROVIDER_LABEL,
        this,
        { supportsMultipleAccounts: true },
      ),
      state.onDidRefreshCredentials((e) => this.onRefresh(e.oldCredentials)),
    );
    logger.info(
      `Declared authentication provider "${CONNECT_AUTH_PROVIDER_ID}"`,
    );
  }

  dispose(): void {
    this.disposable.dispose();
  }

  get onDidChangeSessions(): Event<AuthenticationProviderAuthenticationSessionsChangeEvent> {
    return this.emitter.event;
  }

  // Called by other extensions via authentication.getSession(), and by the
  // editor itself to populate the Accounts UI.
  //
  // Targeting: options.account (whose id is the server URL) wins; otherwise a
  // URL-shaped scope restricts the result to that server; otherwise all
  // Connect sessions are returned.
  async getSessions(
    scopes?: readonly string[],
    options?: AuthenticationProviderSessionOptions,
  ): Promise<AuthenticationSession[]> {
    await this.ensureLoaded();

    const serverUrl = this.targetServerUrl(scopes, options);
    let creds = this.state.credentials.filter(
      (x) => sessionFromCredential(x) !== undefined,
    );
    if (serverUrl) {
      creds = creds.filter((x) => sameServer(x.url, serverUrl));
    }

    if (await this.refreshExpiringTokens(creds)) {
      // Pick up the rotated tokens (this also fires onDidChangeSessions).
      await this.state.refreshCredentials({ silent: true });
      const guids = new Set(creds.map((x) => x.guid));
      creds = this.state.credentials.filter((x) => guids.has(x.guid));
    }

    logger.debug(
      `Got a request for Connect auth sessions, count=${creds.length} url=${serverUrl ?? "<any>"}`,
    );
    return creds
      .map(sessionFromCredential)
      .filter((x): x is AuthenticationSession => x !== undefined);
  }

  // Called by other extensions via authentication.getSession() with
  // createIfNone or forceNewSession set, and by the Accounts UI "Sign in"
  // entry. Runs the regular New Credential flow (browser sign-in), pre-filling
  // the server URL when the caller targeted one.
  async createSession(
    scopes: readonly string[],
    options?: AuthenticationProviderSessionOptions,
  ): Promise<AuthenticationSession> {
    const serverUrl = this.targetServerUrl(scopes, options);
    logger.info(
      `Creating Connect auth session, url=${serverUrl ?? "<user input>"}`,
    );
    const outcome = await commands.executeCommand<
      AddCredentialOutcome | undefined
    >(
      Commands.HomeView.AddCredential,
      serverUrl,
      ServerType.CONNECT,
      "browser",
    );
    if (outcome?.status === "unavailable") {
      throw new Error(outcome.reason);
    }
    if (outcome?.status !== "added") {
      throw new Error("Sign in to Posit Connect was canceled.");
    }

    // The New Credential flow refreshes state.credentials on success, which
    // also fires the "added" change event.
    const cred = this.state.credentials.find(
      (x) => x.guid === outcome.credentialGuid,
    );
    const session = cred ? sessionFromCredential(cred) : undefined;
    if (!session) {
      throw new Error(
        `The credential "${outcome.credentialName}" was created, but it cannot be shared with other extensions. Sign in with a browser (OAuth) or an API key instead.`,
      );
    }
    return session;
  }

  // Called when the user selects "Sign Out" in the Accounts UI.
  async removeSession(sessionId: string): Promise<void> {
    await this.ensureLoaded();
    const cred = this.state.credentials.find((x) => x.guid === sessionId);
    if (!cred) {
      logger.warn(
        `Aborted removing non-existent Connect auth session, id=${sessionId}`,
      );
      throw new Error("No session to remove");
    }
    // This largely follows HomeViewProvider.deleteCredential(), except the
    // Accounts UI already has a confirmation dialog and a success notification,
    // so we skip those bits.
    try {
      await this.state.credentialsService.delete(cred.guid);
    } catch (error: unknown) {
      window.showInformationMessage(
        getSummaryStringFromError("credential::delete", error),
      );
      logger.error(
        `Failed to remove Connect auth session, name=${cred.name} url=${cred.url} error="${error}"`,
      );
      throw error;
    }
    await this.state.refreshCredentials({ silent: true });
  }

  private ensureLoaded(): Promise<void> {
    if (!this.initialLoad) {
      this.initialLoad = this.state.refreshCredentials({ silent: true });
    }
    return this.initialLoad;
  }

  private targetServerUrl(
    scopes?: readonly string[],
    options?: AuthenticationProviderSessionOptions,
  ): string | undefined {
    return options?.account?.id ?? scopes?.find(isUrlScope);
  }

  // Refreshes OAuth access tokens that have expired (or are about to) and
  // persists them. Returns true if any token was rotated. Failures are logged
  // and the stale session is returned anyway; the consumer will get a 401 and
  // can ask for a new session.
  private async refreshExpiringTokens(creds: Credential[]): Promise<boolean> {
    const now = Date.now();
    const results = await Promise.all(
      creds
        .filter((x) => isTokenExpiring(x, now))
        .filter((x) => {
          const failedAt = this.lastRefreshFailure.get(x.guid);
          return !failedAt || now - failedAt >= REFRESH_RETRY_BACKOFF_MS;
        })
        .map((x) => this.refreshToken(x)),
    );
    return results.some(Boolean);
  }

  // Concurrent refreshes of the same credential (including ConnectAPI's 401
  // retry) are merged by CredentialsService.refreshOAuthToken.
  private refreshToken(cred: Credential): Promise<boolean> {
    const insecure = !(
      workspace
        .getConfiguration("positPublisher")
        .get<boolean>("verifyCertificates") ?? true
    );
    return this.state.credentialsService
      .refreshOAuthToken(
        {
          guid: cred.guid,
          url: cred.url,
          oauthClientId: cred.oauthClientId,
          refreshToken: cred.refreshToken,
        },
        insecure,
      )
      .then(() => {
        this.lastRefreshFailure.delete(cred.guid);
        logger.info(
          `Refreshed OAuth token for Connect auth session, name=${cred.name} url=${cred.url}`,
        );
        return true;
      })
      .catch((error: unknown) => {
        this.lastRefreshFailure.set(cred.guid, Date.now());
        logger.warn(
          `Failed to refresh OAuth token for Connect auth session, name=${cred.name} url=${cred.url} error="${error}"`,
        );
        return false;
      });
  }

  private onRefresh(oldCredentials: Credential[]) {
    const toSessions = (creds: Credential[]) => {
      const sessions = new Map<string, AuthenticationSession>();
      for (const cred of creds) {
        const session = sessionFromCredential(cred);
        if (session) {
          sessions.set(session.id, session);
        }
      }
      return sessions;
    };
    const prevSessions = toSessions(oldCredentials);
    const nextSessions = toSessions(this.state.credentials);

    const added: AuthenticationSession[] = [];
    const removed: AuthenticationSession[] = [];
    const changed: AuthenticationSession[] = [];

    for (const [id, prev] of prevSessions) {
      if (!nextSessions.has(id)) {
        removed.push(prev);
        logger.info(
          `Removed Connect auth session, name=${prev.account.label} url=${prev.account.id}`,
        );
      }
    }
    for (const [id, next] of nextSessions) {
      const prev = prevSessions.get(id);
      if (!prev) {
        added.push(next);
        logger.info(
          `Added Connect auth session, name=${next.account.label} url=${next.account.id}`,
        );
      } else if (sessionsDiffer(prev, next)) {
        changed.push(next);
        logger.info(
          `Updated Connect auth session, name=${next.account.label} url=${next.account.id}`,
        );
      }
    }

    if (added.length || removed.length || changed.length) {
      this.emitter.fire({ added, removed, changed });
    }
  }
}
