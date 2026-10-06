// Copyright (C) 2026 by Posit Software, PBC.

// Contract: extension.ts activate() → trust checks, URI handler, command registration, setContext

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  commands,
  workspace,
  window,
  ExtensionMode,
  _testEmitters,
} from "vscode";

// Mock all transitive dependencies of src/extension.ts
import {
  connectSessionMocks,
  providerRegistrationMocks,
  publisherStateMocks,
} from "../helpers/extension-mocks";

const { activate, deactivate } = await import("src/extension");

describe("activation contract", () => {
  function createMockContext() {
    return {
      subscriptions: [] as any[],
      extensionMode: ExtensionMode.Production,
      extension: { packageJSON: { version: "9.8.7" } },
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
    _testEmitters.onDidGrantWorkspaceTrust.dispose();
    workspace.isTrusted = true;
  });

  describe("workspace trust", () => {
    it("checks workspace.isTrusted before initialization", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activate(context);

      // When trusted, commands are registered (initializeExtension runs)
      expect(commands.registerCommand).toHaveBeenCalled();
    });

    it("waits for workspace trust before bootstrapping Connect session files", async () => {
      const context = createMockContext();
      workspace.isTrusted = false;

      await activate(context);

      // onDidGrantWorkspaceTrust should be subscribed
      expect(workspace.onDidGrantWorkspaceTrust).toHaveBeenCalledTimes(1);
      expect(
        connectSessionMocks.bootstrapConnectSession,
      ).not.toHaveBeenCalled();
      expect(providerRegistrationMocks.home).not.toHaveBeenCalled();

      _testEmitters.onDidGrantWorkspaceTrust.fire();
      await vi.waitFor(() =>
        expect(providerRegistrationMocks.home).toHaveBeenCalledOnce(),
      );
      expect(
        connectSessionMocks.bootstrapConnectSession,
      ).toHaveBeenCalledOnce();
    });
  });

  describe("URI handler", () => {
    it("registers a URI handler via window.registerUriHandler", async () => {
      const context = createMockContext();
      await activate(context);

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
      await activate(context);

      expect(registerConnectContentFileSystem).toHaveBeenCalledTimes(1);
    });
  });

  describe("command registration (when trusted)", () => {
    it("registers commands for core extension operations", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activate(context);

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

  describe("Connect session bootstrap", () => {
    it("selects the bootstrapped deployment and refreshes state before registering providers", async () => {
      const context = createMockContext();
      const deployment = {
        deploymentName: "linked app",
        deploymentPath: "/workspace/.posit/publish/deployments/target.toml",
        projectDir: ".",
      };
      connectSessionMocks.bootstrapConnectSession.mockResolvedValueOnce(
        deployment,
      );

      let finishRefresh!: () => void;
      publisherStateMocks.refreshContentRecords.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishRefresh = resolve;
          }),
      );

      const activation = activate(context);
      await vi.waitFor(() =>
        expect(
          publisherStateMocks.refreshContentRecords,
        ).toHaveBeenCalledOnce(),
      );

      expect(providerRegistrationMocks.home).not.toHaveBeenCalled();
      finishRefresh();
      await activation;

      expect(connectSessionMocks.bootstrapConnectSession).toHaveBeenCalledWith(
        "/workspace",
        "9.8.7",
      );
      expect(publisherStateMocks.updateSelection).toHaveBeenCalledWith({
        version: "v1",
        ...deployment,
      });
      expect(publisherStateMocks.refreshConfigurations).toHaveBeenCalledOnce();

      for (const registerProvider of Object.values(providerRegistrationMocks)) {
        expect(registerProvider.mock.invocationCallOrder[0]).toBeGreaterThan(
          publisherStateMocks.refreshContentRecords.mock.invocationCallOrder[0],
        );
        expect(registerProvider.mock.invocationCallOrder[0]).toBeGreaterThan(
          publisherStateMocks.refreshConfigurations.mock.invocationCallOrder[0],
        );
      }
    });

    it("preserves the saved selection when bootstrap finds no deployment", async () => {
      const context = createMockContext();
      connectSessionMocks.bootstrapConnectSession.mockResolvedValueOnce(
        undefined,
      );

      await activate(context);

      expect(publisherStateMocks.updateSelection).not.toHaveBeenCalled();
      expect(publisherStateMocks.refreshContentRecords).not.toHaveBeenCalled();
      expect(publisherStateMocks.refreshConfigurations).not.toHaveBeenCalled();
      expect(providerRegistrationMocks.home).toHaveBeenCalledOnce();
    });

    it("shows bootstrap errors and continues registering the extension", async () => {
      const context = createMockContext();
      connectSessionMocks.bootstrapConnectSession.mockRejectedValueOnce(
        new Error("could not read bundle"),
      );

      await activate(context);

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("could not read bundle"),
      );
      expect(providerRegistrationMocks.home).toHaveBeenCalledOnce();
      expect(commands.registerCommand).toHaveBeenCalled();
    });
  });

  describe("setContext calls", () => {
    it("sets posit.publish.state context to 'initialized' after setup", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activate(context);

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

      await activate(context);

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

      await activate(context);

      expect(workspace.onDidChangeWorkspaceFolders).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscriptions", () => {
    it("pushes disposables to context.subscriptions", async () => {
      const context = createMockContext();
      workspace.isTrusted = true;

      await activate(context);

      expect(context.subscriptions.length).toBeGreaterThan(0);
    });
  });
});
