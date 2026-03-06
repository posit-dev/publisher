// Copyright (C) 2026 by Posit Software, PBC.

// Contract: authProvider.ts → authentication.registerAuthenticationProvider

import { describe, it, expect, beforeEach, vi } from "vitest";
import { authentication, Disposable, EventEmitter } from "vscode";

// Mock internal dependencies
vi.mock("src/api", () => ({
  useApi: vi.fn(() =>
    Promise.resolve({
      credentials: {
        delete: vi.fn(() => Promise.resolve()),
      },
    }),
  ),
  Credential: class {},
}));

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

  it("uses the correct provider ID and label", () => {
    const state = createMockState();
    new PublisherAuthProvider(state as any);

    const [id, label] = vi.mocked(authentication.registerAuthenticationProvider)
      .mock.calls[0];
    expect(id).toBe("posit-connect");
    expect(label).toBe("Posit Connect");
  });

  it("passes the provider instance as the third argument", () => {
    const state = createMockState();
    const provider = new PublisherAuthProvider(state as any);

    const registeredProvider = vi.mocked(
      authentication.registerAuthenticationProvider,
    ).mock.calls[0][2];
    expect(registeredProvider).toBe(provider);
  });

  it("enables supportsMultipleAccounts", () => {
    const state = createMockState();
    new PublisherAuthProvider(state as any);

    const options = vi.mocked(authentication.registerAuthenticationProvider)
      .mock.calls[0][3];
    expect(options).toEqual({ supportsMultipleAccounts: true });
  });

  describe("AuthenticationProvider interface", () => {
    it("implements getSessions that returns sessions from state credentials", async () => {
      const credentials = [
        {
          guid: "1",
          url: "https://connect.example.com",
          name: "Test",
          apiKey: "key1",
        },
      ];
      const state = createMockState(credentials);
      const provider = new PublisherAuthProvider(state as any);

      const sessions = await provider.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("1");
      expect(sessions[0].account.id).toBe("https://connect.example.com");
      expect(sessions[0].account.label).toBe("Test");
      expect(sessions[0].accessToken).toBe("key1");
      expect(sessions[0].scopes).toEqual(["Publisher"]);
    });

    it("implements createSession that throws 'Not supported'", () => {
      const state = createMockState();
      const provider = new PublisherAuthProvider(state as any);

      expect(() => provider.createSession([], {} as any)).toThrow(
        "Not supported",
      );
    });

    it("exposes onDidChangeSessions event", () => {
      const state = createMockState();
      const provider = new PublisherAuthProvider(state as any);

      expect(provider.onDidChangeSessions).toBeDefined();
      expect(typeof provider.onDidChangeSessions).toBe("function");
    });
  });

  describe("dispose", () => {
    it("is callable without error", () => {
      const state = createMockState();
      const provider = new PublisherAuthProvider(state as any);
      expect(() => provider.dispose()).not.toThrow();
    });
  });
});
