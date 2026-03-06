// Copyright (C) 2026 by Posit Software, PBC.

// Contract: extension.ts activate() → trust checks, URI handler, command registration, setContext

import { describe, it, expect, beforeEach, vi } from "vitest";
import { commands, workspace, window, ExtensionMode } from "vscode";

// Mock all transitive dependencies of src/extension.ts
import "../helpers/extension-mocks";

const { activate, deactivate } = await import("src/extension");

describe("activation contract", () => {
  function createMockContext() {
    return {
      subscriptions: [] as any[],
      extensionMode: ExtensionMode.Production,
      extensionUri: { fsPath: "/ext", path: "/ext" },
      extensionPath: "/ext",
      globalState: {
        get: vi.fn(),
        update: vi.fn(() => Promise.resolve()),
        keys: vi.fn(() => []),
        setKeysForSync: vi.fn(),
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(() => Promise.resolve()),
        keys: vi.fn(() => []),
      },
      globalStorageUri: { fsPath: "/storage" },
      storageUri: { fsPath: "/ws-storage" },
      logUri: { fsPath: "/logs" },
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
        onDidChange: vi.fn(),
      },
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    workspace.isTrusted = true;
  });

  // Helper: activate() calls initializeExtension() which is async.
  // We need to flush microtasks to let it complete.
  async function activateAndFlush(context: any) {
    activate(context);
    await vi.waitFor(() => {});
  }

  describe("workspace trust", () => {
    it("checks workspace.isTrusted before initialization", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activateAndFlush(context);

      // When trusted, commands are registered (initializeExtension runs)
      expect(commands.registerCommand).toHaveBeenCalled();
    });

    it("defers initialization when workspace is untrusted", () => {
      const context = createMockContext();
      workspace.isTrusted = false;

      activate(context);

      // onDidGrantWorkspaceTrust should be subscribed
      expect(workspace.onDidGrantWorkspaceTrust).toHaveBeenCalledTimes(1);
      // registerCommand should NOT have been called for internal commands
      // (only registerConnectContentFileSystem and registerUriHandler run immediately)
      const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
      const internalCommands = registerCalls.filter((c) => c[0] !== undefined);
      // No commands should be registered yet (they happen in initializeExtension)
      expect(internalCommands).toHaveLength(0);
    });

    it("subscribes to workspace.onDidGrantWorkspaceTrust when untrusted", () => {
      const context = createMockContext();
      workspace.isTrusted = false;

      activate(context);

      expect(workspace.onDidGrantWorkspaceTrust).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe("URI handler", () => {
    it("registers a URI handler via window.registerUriHandler", () => {
      const context = createMockContext();
      activate(context);

      expect(window.registerUriHandler).toHaveBeenCalledTimes(1);
      expect(window.registerUriHandler).toHaveBeenCalledWith(
        expect.objectContaining({ handleUri: expect.any(Function) }),
      );
    });
  });

  describe("connect-content filesystem", () => {
    it("registers the connect-content file system on activation", async () => {
      const { registerConnectContentFileSystem } =
        await import("src/connect_content_fs");
      const context = createMockContext();
      activate(context);

      expect(registerConnectContentFileSystem).toHaveBeenCalledTimes(1);
    });
  });

  describe("command registration (when trusted)", () => {
    it("registers commands for core extension operations", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activateAndFlush(context);

      const registeredIds = vi
        .mocked(commands.registerCommand)
        .mock.calls.map((c) => c[0]);

      // Check for key commands that initializeExtension registers
      expect(registeredIds).toContain("posit.publisher.logs.fileview");
      expect(registeredIds).toContain("posit.publisher.logs.copy");
      expect(registeredIds).toContain("posit.publisher.init-project");
      expect(registeredIds).toContain("posit.publisher.showOutputChannel");
      expect(registeredIds).toContain("posit.publisher.showPublishingLog");
      expect(registeredIds).toContain("posit.publisher.openConnectContent");
      expect(registeredIds).toContain(
        "posit.publisher.homeView.copySystemInfo",
      );
      expect(registeredIds).toContain("posit.publisher.deployWithEntrypoint");
    });
  });

  describe("setContext calls", () => {
    it("sets posit.publish.state context to 'initialized' after setup", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activateAndFlush(context);

      const setContextCalls = vi
        .mocked(commands.executeCommand)
        .mock.calls.filter((c) => c[0] === "setContext");

      const stateCalls = setContextCalls.filter(
        (c) => c[1] === "posit.publish.state",
      );
      // Should set to "uninitialized" first, then "initialized"
      expect(stateCalls.some((c) => c[2] === "uninitialized")).toBe(true);
      expect(stateCalls.some((c) => c[2] === "initialized")).toBe(true);
    });

    it("sets initialization.inProgress context", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activateAndFlush(context);

      const setContextCalls = vi
        .mocked(commands.executeCommand)
        .mock.calls.filter((c) => c[0] === "setContext");

      const initCalls = setContextCalls.filter(
        (c) => c[1] === "posit.publish.initialization.inProgress",
      );
      expect(initCalls.some((c) => c[2] === "false")).toBe(true);
    });
  });

  describe("workspace folder change listener", () => {
    it("subscribes to workspace.onDidChangeWorkspaceFolders", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activateAndFlush(context);

      expect(workspace.onDidChangeWorkspaceFolders).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscriptions", () => {
    it("pushes disposables to context.subscriptions", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activateAndFlush(context);

      expect(context.subscriptions.length).toBeGreaterThan(0);
    });
  });
});
