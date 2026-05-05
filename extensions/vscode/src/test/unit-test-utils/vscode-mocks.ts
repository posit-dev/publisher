// Copyright (C) 2024 by Posit Software, PBC.

import { vi } from "vitest";

/**
 * Mock class to be used as vscode WorkspaceState.
 * Accepts an initial object as state when instantiated.
 * Implements all the methods which are also spy functions
 * to which it is possible to assert calls.
 *
 * IMPORTANT:
 * Rarely you'll need to create instances of this mock directly.
 * Very likely you'll be better of with the factory function `mkExtensionContextStateMock`
 * to get a vscode mock instance of ExtensionContext.
 *
 * @example
 * const mockWs = new mockWorkspaceState({});
 * // some test operation here ...
 * expect(mockWs.get).toHaveBeenCalledWith("something");
 */
export class mockWorkspaceState {
  private state: Record<PropertyKey, string>;

  constructor(state: Record<PropertyKey, string>) {
    this.state = state;
  }

  readonly keys = vi.fn((): string[] => {
    return Object.keys(this.state);
  });

  readonly get = vi.fn(<T>(key: string, defaultValue?: T) => {
    const v = this.state[key];
    if (v) {
      return v;
    }
    return defaultValue || undefined;
  });

  readonly update = vi.fn((key: string, value: string): Thenable<void> => {
    this.state[key] = value;
    return Promise.resolve();
  });
}

/**
 * Mock class to be used as vscode ExtensionContext.
 * Accepts an initial `mockWorkspaceState`.
 *
 * IMPORTANT:
 * Rarely you'll need to create instances of this mock directly.
 * Very likely you'll be better of with the factory function `mkExtensionContextStateMock`
 * to get a vscode mock instance of ExtensionContext.
 */
/**
 * Mock class to be used as vscode SecretStorage.
 * Uses an in-memory Map for storage.
 */
export class mockSecretStorage {
  private storage = new Map<string, string>();

  readonly get = vi.fn((key: string): Promise<string | undefined> => {
    return Promise.resolve(this.storage.get(key));
  });

  readonly store = vi.fn((key: string, value: string): Promise<void> => {
    this.storage.set(key, value);
    return Promise.resolve();
  });

  readonly delete = vi.fn((key: string): Promise<void> => {
    this.storage.delete(key);
    return Promise.resolve();
  });

  readonly keys = vi.fn((): Promise<string[]> => {
    return Promise.resolve(Array.from(this.storage.keys()));
  });

  readonly onDidChange = vi.fn();
}

export class mockExtensionContext {
  readonly workspaceState: mockWorkspaceState;
  readonly secrets: mockSecretStorage;

  constructor(workspaceState: mockWorkspaceState, secrets: mockSecretStorage) {
    this.workspaceState = workspaceState;
    this.secrets = secrets;
  }
}

/**
 * Factory function to generate a vscode ExtensionContext mock class.
 * @param initState Object to be used as the initial state
 * @returns {Object} Returns an object with mockExtensionContext as mockContext and mockWorkspaceState as mockWorkspace that can be used to assert method calls.
 *
 * @example
 * const { mockWorkspace, mockContext } = new mkExtensionContextStateMock({});
 * const publisherState = new PublisherState(mockContext);
 * publisherState.updateSelection(xyz)
 * expect(mockWorkspace.update).toHaveBeenCalledWith("something");
 */
export const mkExtensionContextStateMock = (
  initState: Record<PropertyKey, string>,
) => {
  const mockWorkspace = new mockWorkspaceState(initState);
  const mockSecrets = new mockSecretStorage();
  const mockContext = new mockExtensionContext(mockWorkspace, mockSecrets);
  return {
    mockWorkspace,
    mockSecrets,
    mockContext,
  };
};
