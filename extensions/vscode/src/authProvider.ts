// Copyright (C) 2025 by Posit Software, PBC.

import {
  authentication,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationProviderSessionOptions,
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  Disposable,
  Event,
  EventEmitter,
  window,
} from "vscode";
import { Credential, useApi } from "./api";
import { PublisherState } from "./state";
import { getSummaryStringFromError } from "./utils/errors";

// AuthenticationProvider identifiers. The main identifier is exposed to other
// extensions for lookup purposes, while the "label" controls what is shown in
// the Accounts UI next to each entry.
//
// Note: must be kept in sync with contributes.authentication in package.json.
const CONNECT_AUTH_PROVIDER_ID = "posit-connect";
const CONNECT_AUTH_PROVIDER_LABEL = "Posit Connect";

// A dedicated output channel for debugging auth-related state changes.
const authLogger = window.createOutputChannel(
  "Posit Publisher Authentication",
  { log: true },
);

class ConnectAuthSession implements AuthenticationSession {
  readonly id: string;
  readonly account: AuthenticationSessionAccountInformation;
  readonly accessToken: string;

  // Note: Connect doesn't really have a notion of "scopes", but we can
  // equivocate to the role here, instead.
  readonly scopes = ["Publisher"];

  constructor(credential: Credential) {
    this.id = credential.guid;
    this.account = { id: credential.url, label: credential.name };
    this.accessToken = credential.apiKey;
  }
}

export class PublisherAuthProvider
  implements AuthenticationProvider, Disposable
{
  private disposable: Disposable;
  private emitter =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();

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
    authLogger.info(
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
  // editor itself to populate the Accounts UI. Also called several times during
  // editor startup, when credentials have not yet been refreshed. It seems
  // harmless to delay until we show the Publisher home view (which loads
  // credentials for the first time), though.
  getSessions(
    _scopes?: string[],
    options?: AuthenticationProviderSessionOptions,
  ): Promise<AuthenticationSession[]> {
    let creds = this.state.credentials;
    if (options?.account) {
      creds = creds.filter((x) => x.url === options?.account?.id);
    }
    authLogger.debug(
      `Got a request for Connect auth sessions, count=${creds.length} url=${options?.account?.id ?? "<any>"}`,
    );
    return Promise.resolve(creds.map((x) => new ConnectAuthSession(x)));
  }

  // Called by other extensions via authentication.getSessions() with
  // createIfNone or forceNewSession set to true.
  //
  // It's unclear whether we should support creating Publisher credentials this
  // way.
  createSession(
    _scopes: string[],
    _options: AuthenticationProviderSessionOptions,
  ): Promise<AuthenticationSession> {
    throw new Error("Not supported");
  }

  // Called when the user selects "Sign Out" in the Accounts UI.
  async removeSession(sessionId: string): Promise<void> {
    const cred = this.state.credentials.find((x) => x.guid === sessionId);
    if (!cred) {
      authLogger.warn(
        `Aborted removing non-existent Connect auth session, id=${sessionId}`,
      );
      throw new Error("No session to remove");
    }
    // This largely follows HomeViewProvider.deleteCredential(), except the
    // Accounts UI already has a confirmation dialog and a success notification,
    // so we skip those bits.
    try {
      const api = await useApi();
      await api.credentials.delete(cred.guid);
    } catch (error: unknown) {
      window.showInformationMessage(
        getSummaryStringFromError("credential::delete", error),
      );
      authLogger.error(
        `Failed to remove Connect auth session, name=${cred.name} url=${cred.url} error="${error}"`,
      );
      throw error;
    }
    await this.state.refreshCredentials();
  }

  private onRefresh(oldCredentials: Credential[]) {
    const added: AuthenticationSession[] = [];
    const removed: AuthenticationSession[] = [];
    const changed: AuthenticationSession[] = [];

    // Find credentials that have been removed.
    for (const prev of oldCredentials) {
      if (!this.state.credentials.find((x) => x.guid === prev.guid)) {
        removed.push(new ConnectAuthSession(prev));
        authLogger.info(
          `Removed Connect auth session, name=${prev.name} url=${prev.url}`,
        );
      }
    }

    // Find credentials that have been added or modified.
    for (const cred of this.state.credentials) {
      const prev = oldCredentials.find((x) => x.guid === cred.guid);
      if (!prev) {
        added.push(new ConnectAuthSession(cred));
        authLogger.info(
          `Added Connect auth session, name=${cred.name} url=${cred.url}`,
        );
      } else if (
        // Check all mutable fields manually.
        prev.name !== cred.name ||
        prev.url !== cred.url ||
        prev.apiKey !== cred.apiKey
      ) {
        changed.push(new ConnectAuthSession(cred));
        authLogger.info(
          `Updated Connect auth session, name=${cred.name} url=${cred.url}`,
        );
      }
    }

    this.emitter.fire({ added: added, removed: removed, changed: changed });
  }
}
