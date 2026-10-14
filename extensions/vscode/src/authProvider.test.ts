// Copyright (C) 2026 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { GUID } from "@posit-dev/connect-api";

const executeCommand = vi.fn();

vi.mock("src/logging");

const forServer = vi.fn();
vi.mock("src/auth/oauth", () => {
  class OAuthTransportUnavailableError extends Error {}
  return {
    ConnectOAuthActivator: {
      forServer: (...args: unknown[]) => forServer(...args),
    },
    OAuthTransportUnavailableError,
  };
});

vi.mock("vscode", () => {
  class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];
    event = (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire(e: T) {
      this.listeners.forEach((l) => l(e));
    }
  }
  return {
    EventEmitter,
    Disposable: { from: () => ({ dispose: () => {} }) },
    authentication: {
      registerAuthenticationProvider: vi.fn(() => ({ dispose: () => {} })),
    },
    commands: {
      executeCommand: (...args: unknown[]) => executeCommand(...args),
    },
    window: { showInformationMessage: vi.fn() },
    workspace: { getConfiguration: () => ({ get: () => undefined }) },
  };
});

import { EventEmitter } from "vscode";
import {
  AUTH_SCHEME_BEARER,
  AUTH_SCHEME_KEY,
  PublisherAuthProvider,
  sessionFromCredential,
} from "./authProvider";
import { Credential } from "./api";
import { ServerType } from "./api/types/contentRecords";
import { CredentialRefreshEvent } from "./state";
import { credentialFactory } from "./test/unit-test-utils/factories";
import { Commands } from "./constants";

function oauthCredential(overrides: Partial<Credential> = {}): Credential {
  return credentialFactory.build({
    apiKey: "",
    oauthClientId: "client-id",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    ...overrides,
  });
}

// A minimal PublisherState stand-in. `stored` plays the role of SecretStorage:
// refreshCredentials() copies it into `credentials` and fires the refresh
// event, like the real implementation.
function mockState(stored: Credential[]) {
  const emitter = new EventEmitter<CredentialRefreshEvent>();
  const credentials: Credential[] = [];
  const state = {
    stored,
    credentials,
    onDidRefreshCredentials: emitter.event,
    refreshCredentials: vi.fn((_opts?: { silent?: boolean }) => {
      const oldCredentials = state.credentials;
      state.credentials = state.stored.map((x) => ({ ...x }));
      emitter.fire({ oldCredentials });
      return Promise.resolve();
    }),
    credentialsService: {
      update: vi.fn((guid: string, patch: Partial<Credential>) => {
        state.stored = state.stored.map((x) =>
          x.guid === guid ? { ...x, ...patch } : x,
        );
        return Promise.resolve();
      }),
      delete: vi.fn((guid: string) => {
        state.stored = state.stored.filter((x) => x.guid !== guid);
        return Promise.resolve();
      }),
      refreshOAuthToken: vi.fn(
        (cred: { guid: string; refreshToken: string }): Promise<string> => {
          const stored = state.stored.find((x) => x.guid === cred.guid);
          if (stored) {
            stored.accessToken = "fresh-token";
            stored.refreshToken = "fresh-refresh";
            stored.tokenExpiresAt = new Date(
              Date.now() + 60 * 60_000,
            ).toISOString();
          }
          return Promise.resolve("fresh-token");
        },
      ),
    },
  };
  return state;
}

function makeProvider(stored: Credential[]) {
  const state = mockState(stored);
  // The mock implements only the parts of PublisherState the provider uses.
  const provider = new PublisherAuthProvider(
    state as unknown as ConstructorParameters<typeof PublisherAuthProvider>[0],
  );
  const events: Array<{
    added?: readonly { id: string }[];
    removed?: readonly { id: string }[];
    changed?: readonly { id: string }[];
  }> = [];
  provider.onDidChangeSessions((e) => events.push(e));
  return { state, provider, events };
}

beforeEach(() => {
  executeCommand.mockReset();
  forServer.mockReset();
});

describe("sessionFromCredential", () => {
  test("uses the API key for API key credentials", () => {
    const cred = credentialFactory.build();
    expect(sessionFromCredential(cred)).toEqual({
      id: cred.guid,
      account: { id: cred.url, label: cred.name },
      accessToken: cred.apiKey,
      scopes: ["Publisher", AUTH_SCHEME_KEY],
    });
  });

  test("uses the OAuth access token for browser sign-in credentials", () => {
    const cred = oauthCredential();
    const session = sessionFromCredential(cred);
    expect(session?.accessToken).toBe("access-token");
    expect(session?.scopes).toEqual(["Publisher", AUTH_SCHEME_BEARER]);
  });

  test("excludes token + private key credentials", () => {
    const cred = credentialFactory.build({
      apiKey: "",
      token: "tok",
      privateKey: "key",
    });
    expect(sessionFromCredential(cred)).toBeUndefined();
  });

  test("excludes Connect Cloud and Snowflake credentials", () => {
    expect(
      sessionFromCredential(
        credentialFactory.build({
          serverType: ServerType.CONNECT_CLOUD,
          apiKey: "",
          accessToken: "cloud-token",
        }),
      ),
    ).toBeUndefined();
    expect(
      sessionFromCredential(
        credentialFactory.build({
          serverType: ServerType.SNOWFLAKE,
          snowflakeConnection: "conn",
        }),
      ),
    ).toBeUndefined();
  });
});

describe("PublisherAuthProvider.getSessions", () => {
  test("loads credentials on first use without the Home view", async () => {
    const cred = credentialFactory.build();
    const { state, provider } = makeProvider([cred]);

    const sessions = await provider.getSessions();
    expect(sessions.map((s) => s.id)).toEqual([cred.guid]);
    expect(state.refreshCredentials).toHaveBeenCalledWith({ silent: true });

    await provider.getSessions();
    expect(state.refreshCredentials).toHaveBeenCalledTimes(1);
  });

  test("skips credentials that cannot be shared", async () => {
    const shareable = credentialFactory.build();
    const cloud = credentialFactory.build({
      serverType: ServerType.CONNECT_CLOUD,
    });
    const { provider } = makeProvider([shareable, cloud]);
    const sessions = await provider.getSessions();
    expect(sessions.map((s) => s.id)).toEqual([shareable.guid]);
  });

  test("filters by options.account", async () => {
    const [a, b] = credentialFactory.buildList(2);
    const { provider } = makeProvider([a!, b!]);
    const sessions = await provider.getSessions([], {
      account: { id: b!.url, label: b!.name },
    });
    expect(sessions.map((s) => s.id)).toEqual([b!.guid]);
  });

  test("filters by a URL scope, ignoring case and trailing slash", async () => {
    const a = credentialFactory.build({ url: "https://a.example.com" });
    const b = credentialFactory.build({ url: "https://b.example.com" });
    const { provider } = makeProvider([a, b]);
    const sessions = await provider.getSessions(["HTTPS://B.example.com/"]);
    expect(sessions.map((s) => s.id)).toEqual([b.guid]);
  });

  test("options.account wins over a URL scope", async () => {
    const a = credentialFactory.build({ url: "https://a.example.com" });
    const b = credentialFactory.build({ url: "https://b.example.com" });
    const { provider } = makeProvider([a, b]);
    const sessions = await provider.getSessions(["https://b.example.com"], {
      account: { id: a.url, label: a.name },
    });
    expect(sessions.map((s) => s.id)).toEqual([a.guid]);
  });

  test("ignores non-URL scopes", async () => {
    const [a, b] = credentialFactory.buildList(2);
    const { provider } = makeProvider([a!, b!]);
    const sessions = await provider.getSessions(["Publisher"]);
    expect(sessions).toHaveLength(2);
  });

  test("returns valid OAuth tokens without refreshing", async () => {
    const cred = oauthCredential();
    const { state, provider } = makeProvider([cred]);
    const sessions = await provider.getSessions();
    expect(sessions[0]?.accessToken).toBe("access-token");
    expect(state.credentialsService.refreshOAuthToken).not.toHaveBeenCalled();
  });

  test("refreshes expired OAuth tokens and fires a change event", async () => {
    const cred = oauthCredential({
      tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const { state, provider, events } = makeProvider([cred]);

    const sessions = await provider.getSessions();

    expect(state.credentialsService.refreshOAuthToken).toHaveBeenCalledWith(
      {
        guid: cred.guid,
        url: cred.url,
        oauthClientId: "client-id",
        refreshToken: "refresh-token",
      },
      false,
    );
    expect(sessions[0]?.accessToken).toBe("fresh-token");
    expect(events.at(-1)?.changed?.map((s) => s.id)).toEqual([cred.guid]);
  });

  test("refreshes tokens that are about to expire", async () => {
    const cred = oauthCredential({
      tokenExpiresAt: new Date(Date.now() + 10_000).toISOString(),
    });
    const { provider } = makeProvider([cred]);
    const sessions = await provider.getSessions();
    expect(sessions[0]?.accessToken).toBe("fresh-token");
  });

  test("returns the stale session when the refresh fails, and backs off", async () => {
    const cred = oauthCredential({
      tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const { state, provider } = makeProvider([cred]);
    state.credentialsService.refreshOAuthToken.mockRejectedValue(
      new Error("offline"),
    );

    const sessions = await provider.getSessions();
    expect(sessions[0]?.accessToken).toBe("access-token");

    await provider.getSessions();
    expect(state.credentialsService.refreshOAuthToken).toHaveBeenCalledTimes(1);
  });
});

describe("PublisherAuthProvider change events", () => {
  test("reports added, removed and changed sessions", async () => {
    const [keep, remove, rotate] = credentialFactory.buildList(3);
    const { state, provider, events } = makeProvider([keep!, remove!, rotate!]);
    await provider.getSessions();
    expect(events).toHaveLength(1);
    expect(events[0]?.added).toHaveLength(3);

    const added = credentialFactory.build();
    state.stored = [keep!, { ...rotate!, apiKey: "rotated" }, added];
    await state.refreshCredentials();

    expect(events).toHaveLength(2);
    expect(events[1]?.added?.map((s) => s.id)).toEqual([added.guid]);
    expect(events[1]?.removed?.map((s) => s.id)).toEqual([remove!.guid]);
    expect(events[1]?.changed?.map((s) => s.id)).toEqual([rotate!.guid]);
  });

  test("detects OAuth access token rotation", async () => {
    const cred = oauthCredential();
    const { state, provider, events } = makeProvider([cred]);
    await provider.getSessions();

    state.stored = [{ ...cred, accessToken: "rotated" }];
    await state.refreshCredentials();

    expect(events.at(-1)?.changed?.map((s) => s.id)).toEqual([cred.guid]);
  });

  test("does not fire when nothing changed", async () => {
    const { state, provider, events } = makeProvider([
      credentialFactory.build(),
    ]);
    await provider.getSessions();
    await state.refreshCredentials();
    expect(events).toHaveLength(1);
  });

  test("ignores credentials that cannot be shared", async () => {
    const { state, provider, events } = makeProvider([]);
    await provider.getSessions();
    state.stored = [
      credentialFactory.build({ serverType: ServerType.CONNECT_CLOUD }),
    ];
    await state.refreshCredentials();
    expect(events).toHaveLength(0);
  });
});

describe("PublisherAuthProvider.createSession", () => {
  test("runs the New Credential flow and returns the new session", async () => {
    const created = credentialFactory.build({
      guid: GUID("11111111-2222-3333-4444-555555555555"),
      url: "https://connect.example.com",
    });
    const { state, provider } = makeProvider([]);
    executeCommand.mockImplementation(async () => {
      state.stored = [created];
      await state.refreshCredentials();
      return {
        status: "added",
        credentialName: created.name,
        credentialGuid: created.guid,
      };
    });

    const session = await provider.createSession([
      "https://connect.example.com",
    ]);

    expect(executeCommand).toHaveBeenCalledWith(
      Commands.HomeView.AddCredential,
      "https://connect.example.com",
      ServerType.CONNECT,
      "browser",
    );
    expect(session.id).toBe(created.guid);
  });

  test("pre-fills the URL from options.account", async () => {
    const { provider } = makeProvider([]);
    executeCommand.mockResolvedValue({ status: "canceled" });
    await expect(
      provider.createSession([], {
        account: { id: "https://a.example.com", label: "a" },
      }),
    ).rejects.toThrow();
    expect(executeCommand).toHaveBeenCalledWith(
      Commands.HomeView.AddCredential,
      "https://a.example.com",
      ServerType.CONNECT,
      "browser",
    );
  });

  test("lets the user enter a URL when none is targeted", async () => {
    const { provider } = makeProvider([]);
    executeCommand.mockResolvedValue({ status: "canceled" });
    await expect(provider.createSession(["Publisher"])).rejects.toThrow(
      "canceled",
    );
    expect(executeCommand).toHaveBeenCalledWith(
      Commands.HomeView.AddCredential,
      undefined,
      ServerType.CONNECT,
      "browser",
    );
  });

  test("rejects when Connect is unavailable", async () => {
    const { provider } = makeProvider([]);
    executeCommand.mockResolvedValue({
      status: "unavailable",
      reason: "Posit Connect is not available.",
    });
    await expect(provider.createSession([])).rejects.toThrow(
      "Posit Connect is not available.",
    );
  });

  test("rejects when the new credential cannot be shared", async () => {
    const created = credentialFactory.build({
      apiKey: "",
      token: "tok",
      privateKey: "key",
    });
    const { state, provider } = makeProvider([]);
    executeCommand.mockImplementation(async () => {
      state.stored = [created];
      await state.refreshCredentials();
      return {
        status: "added",
        credentialName: created.name,
        credentialGuid: created.guid,
      };
    });
    await expect(provider.createSession([])).rejects.toThrow(
      "cannot be shared",
    );
  });
});

describe("PublisherAuthProvider.createSession for an existing credential", () => {
  const signIn = {
    oauthClientId: "new-client",
    accessToken: "new-access",
    refreshToken: "new-refresh",
    tokenExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    userName: "me",
  };

  test("signs in again in place (forceNewSession)", async () => {
    const cred = oauthCredential({ url: "https://connect.example.com" });
    const { state, provider, events } = makeProvider([cred]);
    forServer.mockResolvedValue({
      authenticate: () => Promise.resolve(signIn),
    });

    const session = await provider.createSession([], {
      account: { id: cred.url, label: cred.name },
    });

    expect(executeCommand).not.toHaveBeenCalled();
    expect(forServer).toHaveBeenCalledWith(cred.url, "", false);
    expect(session.id).toBe(cred.guid);
    expect(session.accessToken).toBe("new-access");
    expect(state.stored[0]).toMatchObject({
      guid: cred.guid,
      name: cred.name,
      oauthClientId: "new-client",
      refreshToken: "new-refresh",
    });
    expect(events.at(-1)?.changed?.map((s) => s.id)).toEqual([cred.guid]);
  });

  test("matches the server from a URL scope", async () => {
    const cred = credentialFactory.build({
      url: "https://connect.example.com",
    });
    const { provider } = makeProvider([cred]);
    forServer.mockResolvedValue({
      authenticate: () => Promise.resolve(signIn),
    });
    const session = await provider.createSession([
      "https://CONNECT.example.com/",
    ]);
    expect(session.id).toBe(cred.guid);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  test("upgrades a credential that couldn't be shared", async () => {
    const cred = credentialFactory.build({
      url: "https://connect.example.com",
      apiKey: "",
      token: "tok",
      privateKey: "key",
    });
    const { state, provider, events } = makeProvider([cred]);
    forServer.mockResolvedValue({
      authenticate: () => Promise.resolve(signIn),
    });

    const session = await provider.createSession([cred.url]);

    expect(session.scopes).toContain(AUTH_SCHEME_BEARER);
    expect(state.stored[0]).toMatchObject({ token: "", privateKey: "" });
    expect(events.at(-1)?.added?.map((s) => s.id)).toEqual([cred.guid]);
  });

  test("replaces an API key with OAuth tokens", async () => {
    const cred = credentialFactory.build({
      url: "https://connect.example.com",
    });
    const { state, provider } = makeProvider([cred]);
    forServer.mockResolvedValue({
      authenticate: () => Promise.resolve(signIn),
    });
    await provider.createSession([cred.url]);
    expect(state.stored[0]).toMatchObject({
      apiKey: "",
      accessToken: "new-access",
    });
  });

  test("rejects, leaving the credential alone, when the server has no OAuth", async () => {
    const cred = credentialFactory.build({
      url: "https://connect.example.com",
    });
    const { state, provider } = makeProvider([cred]);
    forServer.mockResolvedValue(undefined);
    await expect(provider.createSession([cred.url])).rejects.toThrow(
      "does not support browser sign-in",
    );
    expect(state.credentialsService.update).not.toHaveBeenCalled();
  });

  test("rejects when the user cancels sign-in", async () => {
    const cred = oauthCredential({ url: "https://connect.example.com" });
    const { state, provider } = makeProvider([cred]);
    forServer.mockResolvedValue({
      authenticate: () => Promise.reject(new Error("canceled")),
    });
    await expect(provider.createSession([cred.url])).rejects.toThrow(
      "canceled",
    );
    expect(state.credentialsService.update).not.toHaveBeenCalled();
  });

  test("rejects for a Snowflake credential", async () => {
    const cred = credentialFactory.build({
      url: "https://connect.example.com",
      serverType: ServerType.SNOWFLAKE,
    });
    const { provider } = makeProvider([cred]);
    await expect(provider.createSession([cred.url])).rejects.toThrow(
      "Snowflake",
    );
    expect(forServer).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });
});

describe("PublisherAuthProvider.removeSession", () => {
  test("deletes the credential and refreshes", async () => {
    const cred = credentialFactory.build();
    const { state, provider, events } = makeProvider([cred]);
    await provider.removeSession(cred.guid);
    expect(state.credentialsService.delete).toHaveBeenCalledWith(cred.guid);
    expect(events.at(-1)?.removed?.map((s) => s.id)).toEqual([cred.guid]);
  });

  test("rejects unknown sessions", async () => {
    const { provider } = makeProvider([]);
    await expect(provider.removeSession("nope")).rejects.toThrow(
      "No session to remove",
    );
  });
});
