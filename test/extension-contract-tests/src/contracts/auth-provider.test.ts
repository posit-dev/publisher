// Copyright (C) 2026 by Posit Software, PBC.

// Contract: authProvider.ts → authentication.registerAuthenticationProvider

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  authentication,
  commands,
  Disposable,
  EventEmitter,
  workspace,
} from "vscode";

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

  it("createSession runs the New Credential command via commands.executeCommand", async () => {
    const state = createMockState();
    const provider = new PublisherAuthProvider(state as any);
    vi.mocked(commands.executeCommand).mockResolvedValueOnce({
      status: "canceled",
    });

    await expect(
      provider.createSession(["https://connect.example.com"]),
    ).rejects.toThrow();
    expect(commands.executeCommand).toHaveBeenCalledWith(
      "posit.publisher.homeView.addCredential",
      "https://connect.example.com",
      "connect",
      "browser",
    );
  });

  it("reads positPublisher.verifyCertificates when refreshing an expired OAuth token", async () => {
    const credential = {
      guid: "guid-1",
      name: "prod",
      url: "https://connect.example.com",
      apiKey: "",
      oauthClientId: "client",
      accessToken: "old",
      refreshToken: "refresh",
      tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
      serverType: "connect",
    };
    const state = {
      ...createMockState([credential]),
      credentialsService: {
        refreshOAuthToken: vi.fn(() => Promise.resolve("new")),
      },
    };
    const provider = new PublisherAuthProvider(state as any);

    await provider.getSessions();

    expect(workspace.getConfiguration).toHaveBeenCalledWith("positPublisher");
    expect(state.credentialsService.refreshOAuthToken).toHaveBeenCalledWith(
      expect.objectContaining({ guid: "guid-1" }),
      false,
    );
  });

  it("exposes onDidChangeSessions event", () => {
    const state = createMockState();
    const provider = new PublisherAuthProvider(state as any);

    expect(provider.onDidChangeSessions).toBeDefined();
    expect(typeof provider.onDidChangeSessions).toBe("function");
  });
});
