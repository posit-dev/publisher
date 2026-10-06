// Copyright (C) 2026 by Posit Software, PBC.

// Contract: authProvider.ts → authentication.registerAuthenticationProvider

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authentication, Disposable, EventEmitter } from "vscode";
import { CONNECT_SESSION_CREDENTIAL_GUID } from "src/api/types/credentials";

// Mock internal dependencies
vi.mock("src/logging", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("src/utils/errors", () => ({
  getSummaryStringFromError: vi.fn((loc: string, err: any) => `${loc}: ${err}`),
}));

const { PublisherAuthProvider } = await import("src/authProvider");

describe("auth-provider contract", () => {
  function createMockState(credentials: any[] = []) {
    const emitter = new EventEmitter<any>();
    return {
      credentials,
      onDidRefreshCredentials: vi.fn((listener: any) =>
        emitter.event(listener),
      ),
      refreshCredentials: vi.fn(() => Promise.resolve()),
      _fireRefresh: (e: any) => emitter.fire(e),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the current session key without putting it in the credential", async () => {
    const credential = {
      guid: CONNECT_SESSION_CREDENTIAL_GUID,
      name: "Posit Connect (session)",
      url: "https://connect.example.com",
      apiKey: "",
    };
    const state = createMockState([credential]);
    const provider = new PublisherAuthProvider(state as any);
    vi.stubEnv("CONNECT_API_KEY", "first-key");
    expect((await provider.getSessions())[0]?.accessToken).toBe("first-key");
    vi.stubEnv("CONNECT_API_KEY", "rotated-key");
    expect((await provider.getSessions())[0]?.accessToken).toBe("rotated-key");
    expect(credential.apiKey).toBe("");
  });

  it("can select saved and session credentials separately on the same server", async () => {
    const url = "https://connect.example.com";
    const saved = {
      guid: "saved-guid",
      name: "Saved",
      url,
      apiKey: "saved-key",
    };
    const session = {
      guid: CONNECT_SESSION_CREDENTIAL_GUID,
      name: "Posit Connect (session)",
      url,
      apiKey: "",
    };
    const provider = new PublisherAuthProvider(
      createMockState([session, saved]) as any,
    );
    vi.stubEnv("CONNECT_API_KEY", "session-key");
    const sessions = await provider.getSessions();
    expect(new Set(sessions.map((value) => value.account.id)).size).toBe(2);
    expect(
      await provider.getSessions(undefined, {
        account: { id: url, label: saved.name },
      }),
    ).toEqual([
      expect.objectContaining({ id: "saved-guid", accessToken: "saved-key" }),
    ]);
    expect(
      await provider.getSessions(undefined, {
        account: { id: CONNECT_SESSION_CREDENTIAL_GUID, label: session.name },
      }),
    ).toEqual([
      expect.objectContaining({
        id: CONNECT_SESSION_CREDENTIAL_GUID,
        accessToken: "session-key",
      }),
    ]);
  });

  it("registers with authentication.registerAuthenticationProvider", () => {
    const state = createMockState();
    new PublisherAuthProvider(state as any);

    expect(authentication.registerAuthenticationProvider).toHaveBeenCalledWith(
      "posit-connect",
      "Posit Connect",
      expect.any(Object),
      { supportsMultipleAccounts: true },
    );
  });

  it("exposes onDidChangeSessions event", () => {
    const state = createMockState();
    const provider = new PublisherAuthProvider(state as any);

    expect(provider.onDidChangeSessions).toBeDefined();
    expect(typeof provider.onDidChangeSessions).toBe("function");
  });
});
