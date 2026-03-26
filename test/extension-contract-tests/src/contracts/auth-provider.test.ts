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

  it("exposes onDidChangeSessions event", () => {
    const state = createMockState();
    const provider = new PublisherAuthProvider(state as any);

    expect(provider.onDidChangeSessions).toBeDefined();
    expect(typeof provider.onDidChangeSessions).toBe("function");
  });
});
