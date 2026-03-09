// Copyright (C) 2026 by Posit Software, PBC.

// Comprehensive mock of the "vscode" module for contract tests.
//
// This file is aliased to the "vscode" module via vitest.config.ts, so any
// `import { ... } from "vscode"` in extension source code resolves here.
// All exported names mirror the real VS Code API surface so that extension
// source files can be imported without modification.
//
// Key design decisions:
// - Functions are vi.fn() spies so tests can assert calls and configure returns.
// - Classes (Disposable, EventEmitter, etc.) have real implementations because
//   extension code relies on their constructor/method behavior at runtime.
// - Internal EventEmitter instances are exposed via `_testEmitters` (at the
//   bottom of this file) so tests can programmatically fire events like
//   onDidChangeActiveTextEditor to simulate user/editor actions.

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
// These must match the real vscode enum values because extension code compares
// against them (e.g., `if (mode === ExtensionMode.Production)`). The numeric
// values come from the VS Code API documentation.

// Used by tree view providers to control expand/collapse state of tree items.
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

// Used by the workspace.fs API and file system providers to indicate entry type.
export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

// Controls where progress indicators appear in the VS Code UI.
// The extension uses Notification (toast) for deployment progress.
export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// Indicates how the extension was launched. The extension checks this to
// conditionally enable development-only features.
export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

// Built-in quick input navigation buttons.
export enum QuickInputButtons {
  Back = "Back",
}

// ---------------------------------------------------------------------------
// Constructors / Classes
// ---------------------------------------------------------------------------
// These have real implementations (not just spies) because extension code
// instantiates them and depends on their runtime behavior — for example,
// registering a command returns a Disposable whose dispose() must actually
// clean up, and EventEmitter.fire() must actually invoke listeners.

// Represents a resource cleanup handle. VS Code returns Disposables from most
// registration APIs (registerCommand, onDidChange*, etc.) so code can later
// unsubscribe. This implementation is functionally equivalent to the real one.
export class Disposable {
  private _callOnDispose: () => void;
  constructor(callOnDispose: () => void) {
    this._callOnDispose = callOnDispose;
  }
  dispose() {
    this._callOnDispose();
  }
  static from(...disposables: { dispose: () => void }[]): Disposable {
    return new Disposable(() => disposables.forEach((d) => d.dispose()));
  }
}

// A working event emitter that supports subscribe/fire/dispose. Extension code
// creates its own EventEmitters for custom events and also subscribes to VS Code
// events. The `event` property is a function that registers a listener and returns
// a Disposable for unsubscription — matching the real VS Code API pattern.
export class EventEmitter<T = void> {
  private listeners: Array<(e: T) => void> = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return new Disposable(() => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    });
  };
  fire(data: T) {
    for (const listener of this.listeners) {
      listener(data);
    }
  }
  dispose() {
    this.listeners = [];
  }
}

// Mock of vscode.Uri — the extension's primary abstraction for file paths and
// URLs. Each factory method (file, joinPath, from, parse) returns an object with
// the same shape as a real Uri: fsPath, path, scheme, authority, query, fragment,
// with(), and toString(). Methods are spies so tests can assert construction args.
export const Uri = {
  // Uri.file("/some/path") — creates a file:// URI from an absolute filesystem path.
  file: vi.fn((path: string) => ({
    fsPath: path,
    path,
    scheme: "file",
    authority: "",
    query: "",
    fragment: "",
    with: vi.fn(function (this: any, change: Record<string, string>) {
      return { ...this, ...change };
    }),
    toString: vi.fn(function (this: any) {
      return `file://${this.path}`;
    }),
  })),
  // Uri.joinPath(base, "subdir", "file.txt") — appends path segments to an existing Uri.
  joinPath: vi.fn(
    (base: { fsPath: string; path: string }, ...segments: string[]) => {
      const joined = [base.fsPath, ...segments].join("/");
      return {
        fsPath: joined,
        path: joined,
        scheme: "file",
        authority: "",
        query: "",
        fragment: "",
        with: vi.fn(function (this: any, change: Record<string, string>) {
          return { ...this, ...change };
        }),
        toString: vi.fn(function (this: any) {
          return `file://${this.path}`;
        }),
      };
    },
  ),
  // Uri.from({ scheme, authority, path, ... }) — constructs a Uri from components.
  from: vi.fn(
    (components: {
      scheme: string;
      authority?: string;
      path?: string;
      query?: string;
      fragment?: string;
    }) => ({
      scheme: components.scheme,
      authority: components.authority ?? "",
      path: components.path ?? "",
      query: components.query ?? "",
      fragment: components.fragment ?? "",
      fsPath: components.path ?? "",
      with: vi.fn(function (this: any, change: Record<string, string>) {
        return { ...this, ...change };
      }),
      toString: vi.fn(function (this: any) {
        return `${this.scheme}://${this.authority}${this.path}${this.query ? "?" + this.query : ""}`;
      }),
    }),
  ),
  // Uri.parse("https://example.com/path") — parses a string into a Uri.
  // Uses the real URL constructor for accurate parsing behavior.
  parse: vi.fn((value: string) => {
    const url = new URL(value);
    return {
      scheme: url.protocol.replace(":", ""),
      authority: url.host,
      path: url.pathname,
      query: url.search.replace("?", ""),
      fragment: url.hash.replace("#", ""),
      fsPath: url.pathname,
      with: vi.fn(function (this: any, change: Record<string, string>) {
        return { ...this, ...change };
      }),
      toString: () => value,
    };
  }),
};

// Icon reference used in tree views, status bars, etc.
export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: ThemeColor,
  ) {}
}

// Color reference from the current VS Code theme.
export class ThemeColor {
  constructor(public readonly id: string) {}
}

// Combines a workspace folder (or Uri) with a glob pattern for scoped file
// watching. The extension uses this with createFileSystemWatcher to watch only
// files within the project directory (e.g., `.posit/publish/**/*.toml`).
export class RelativePattern {
  constructor(
    public readonly base: any,
    public readonly pattern: string,
  ) {}
}

// Base class for sidebar tree view items (deployment list, server list, etc.).
export class TreeItem {
  label?: string;
  collapsibleState?: TreeItemCollapsibleState;
  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

// Text document range (start/end positions). Used for document edit operations.
export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

// Zero-based line and character position within a text document.
export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

// Error factories used by FileSystemProvider implementations. The extension's
// connect_content_fs.ts (Connect content browser) throws these when remote file
// operations fail. Each factory creates an Error with a `.code` property matching
// what VS Code expects for proper error handling in the file explorer UI.
export const FileSystemError = {
  FileNotFound: vi.fn((uri?: any) => {
    const err = new Error("FileNotFound");
    (err as any).code = "FileNotFound";
    (err as any).uri = uri;
    return err;
  }),
  FileExists: vi.fn((uri?: any) => {
    const err = new Error("FileExists");
    (err as any).code = "FileExists";
    (err as any).uri = uri;
    return err;
  }),
  FileNotADirectory: vi.fn((uri?: any) => {
    const err = new Error("FileNotADirectory");
    (err as any).code = "FileNotADirectory";
    (err as any).uri = uri;
    return err;
  }),
  FileIsADirectory: vi.fn((uri?: any) => {
    const err = new Error("FileIsADirectory");
    (err as any).code = "FileIsADirectory";
    (err as any).uri = uri;
    return err;
  }),
  NoPermissions: vi.fn((msg?: string) => {
    const err = new Error(msg ?? "NoPermissions");
    (err as any).code = "NoPermissions";
    return err;
  }),
};

// ---------------------------------------------------------------------------
// Namespace: commands
// ---------------------------------------------------------------------------
// The extension registers ~20 commands (deploy, redeploy, open logs, etc.) via
// registerCommand and triggers built-in commands via executeCommand (e.g.,
// "setContext" to toggle when-clause contexts, "vscode.open" to open URLs).

export const commands = {
  registerCommand: vi.fn(
    (_id: string, _handler: (...args: any[]) => any) =>
      new Disposable(() => {}),
  ),
  executeCommand: vi.fn((..._args: any[]) => Promise.resolve()),
};

// ---------------------------------------------------------------------------
// Namespace: window
// ---------------------------------------------------------------------------
// Covers the extension's UI interactions: dialogs, progress toasts, terminals,
// tree views, URI handlers, and editor change tracking.

// Internal emitters for window events. Tests fire these via _testEmitters
// (exported at the bottom) to simulate the user switching editors, closing
// terminals, etc.
const _onDidChangeActiveTextEditor = new EventEmitter<any>();
const _onDidChangeActiveNotebookEditor = new EventEmitter<any>();
const _onDidCloseTerminal = new EventEmitter<any>();

export const window = {
  // Dialog methods — default to resolving undefined (user dismissed the dialog).
  // Tests override via mockReturnValue/mockResolvedValue to simulate button clicks.
  showErrorMessage: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  showInformationMessage: vi.fn((..._args: any[]) =>
    Promise.resolve(undefined),
  ),
  showWarningMessage: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  // Text input — used by open_connect.ts to prompt for a Connect server URL.
  showInputBox: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  // Progress indicator — immediately invokes the task callback with a mock
  // progress reporter and cancellation token, simulating synchronous completion.
  withProgress: vi.fn(
    (_options: any, task: (progress: any, token: any) => Promise<any>) =>
      task(
        { report: vi.fn() },
        { isCancellationRequested: false, onCancellationRequested: vi.fn() },
      ),
  ),
  // Terminal creation — the extension runs deployment commands in integrated terminals.
  createTerminal: vi.fn(() => ({
    sendText: vi.fn(),
    show: vi.fn(),
    exitStatus: { code: 0 },
    dispose: vi.fn(),
  })),
  // Tree view — powers the sidebar panels (deployments list, credentials, etc.).
  createTreeView: vi.fn(() => ({
    onDidChangeSelection: vi.fn(),
    onDidExpandElement: vi.fn(),
    onDidCollapseElement: vi.fn(),
    onDidChangeVisibility: vi.fn(),
    dispose: vi.fn(),
    reveal: vi.fn(),
  })),
  showTextDocument: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  // URI handler — enables posit-publisher:// deep links for OAuth callbacks.
  registerUriHandler: vi.fn((_handler: any) => new Disposable(() => {})),
  // Editor change events — the extension tracks which file is active to update
  // the entrypoint context and refresh deployment UI accordingly.
  onDidChangeActiveTextEditor: vi.fn((listener: any, thisArg?: any) =>
    _onDidChangeActiveTextEditor.event(
      thisArg ? listener.bind(thisArg) : listener,
    ),
  ),
  onDidChangeActiveNotebookEditor: vi.fn((listener: any, thisArg?: any) =>
    _onDidChangeActiveNotebookEditor.event(
      thisArg ? listener.bind(thisArg) : listener,
    ),
  ),
  onDidCloseTerminal: vi.fn((listener: any) =>
    _onDidCloseTerminal.event(listener),
  ),
  // Current editor state — tests can set these before importing extension code
  // to simulate an already-open editor.
  activeTextEditor: undefined as any,
  activeNotebookEditor: undefined as any,
  tabGroups: {
    activeTabGroup: { activeTab: undefined as any },
    onDidChangeTabGroups: vi.fn(
      (_listener: any, _thisArg?: any) => new Disposable(() => {}),
    ),
  },
};

// ---------------------------------------------------------------------------
// Namespace: workspace
// ---------------------------------------------------------------------------
// Covers configuration reading, workspace folder management, file watching,
// filesystem provider registration, and document lifecycle events.

// Mock for WorkspaceConfiguration.get() — returns undefined by default.
// Tests override via mockConfigGet.mockImplementation() to simulate specific
// settings (e.g., "positPublisher.executable" or "positron.r.interpreterPath").
const mockConfigGet = vi.fn((_key?: string) => undefined);
// Mock for workspace.getConfiguration() — returns a configuration object scoped
// to the requested section (e.g., "positPublisher", "positron.r").
const mockGetConfiguration = vi.fn((_section?: string) => ({
  get: mockConfigGet,
  has: vi.fn(() => false),
  inspect: vi.fn(() => undefined),
  update: vi.fn(() => Promise.resolve()),
}));

// Internal emitters for workspace events. Tests fire these via _testEmitters
// to simulate workspace trust changes, folder additions/removals, and
// document save/close events that trigger deployment config reloads.
const _onDidGrantWorkspaceTrust = new EventEmitter<void>();
const _onDidChangeWorkspaceFolders = new EventEmitter<any>();
const _onDidCloseTextDocument = new EventEmitter<any>();
const _onDidSaveTextDocument = new EventEmitter<any>();
const _onDidCloseNotebookDocument = new EventEmitter<any>();
const _onDidSaveNotebookDocument = new EventEmitter<any>();

// Factory for mock FileSystemWatcher instances. The extension creates watchers
// for .posit/publish/ config files to auto-refresh when configs change on disk.
const mockFileSystemWatcher = () => ({
  onDidCreate: vi.fn(() => new Disposable(() => {})),
  onDidChange: vi.fn(() => new Disposable(() => {})),
  onDidDelete: vi.fn(() => new Disposable(() => {})),
  dispose: vi.fn(),
});

export const workspace = {
  getConfiguration: mockGetConfiguration,
  // Pre-populated with a single workspace folder at "/workspace". Tests that
  // need multi-root workspaces can push additional entries before importing
  // extension code.
  workspaceFolders: [
    {
      uri: { fsPath: "/workspace", path: "/workspace", scheme: "file" },
      name: "workspace",
      index: 0,
    },
  ] as any[],
  // Starts trusted. The extension gates activation on workspace trust —
  // set to false in tests to verify the trust-gating behavior.
  isTrusted: true,
  onDidGrantWorkspaceTrust: vi.fn((listener: any) =>
    _onDidGrantWorkspaceTrust.event(listener),
  ),
  onDidChangeWorkspaceFolders: vi.fn((listener: any) =>
    _onDidChangeWorkspaceFolders.event(listener),
  ),
  // Returns true (success) by default. Used by open_connect.ts to add a
  // Connect server's content as a virtual workspace folder.
  updateWorkspaceFolders: vi.fn((..._args: any[]) => true),
  // Creates a file watcher — the extension watches .posit/publish/*.toml and
  // deployment record files for changes.
  createFileSystemWatcher: vi.fn((..._args: any[]) => mockFileSystemWatcher()),
  // Registers a virtual filesystem provider. The extension registers one for
  // the "connect-content" scheme to browse deployed content on Connect.
  registerFileSystemProvider: vi.fn(
    (..._args: any[]) => new Disposable(() => {}),
  ),
  openTextDocument: vi.fn((..._args: any[]) => Promise.resolve({})),
  // Document lifecycle events — the extension uses these to track which
  // documents are open/saved to keep the entrypoint tracker in sync.
  onDidCloseTextDocument: vi.fn((listener: any, thisArg?: any) =>
    _onDidCloseTextDocument.event(thisArg ? listener.bind(thisArg) : listener),
  ),
  onDidSaveTextDocument: vi.fn((listener: any, thisArg?: any) =>
    _onDidSaveTextDocument.event(thisArg ? listener.bind(thisArg) : listener),
  ),
  onDidCloseNotebookDocument: vi.fn((listener: any, thisArg?: any) =>
    _onDidCloseNotebookDocument.event(
      thisArg ? listener.bind(thisArg) : listener,
    ),
  ),
  onDidSaveNotebookDocument: vi.fn((listener: any, thisArg?: any) =>
    _onDidSaveNotebookDocument.event(
      thisArg ? listener.bind(thisArg) : listener,
    ),
  ),
  // Simplified workspace.fs — the virtual filesystem API. All methods resolve
  // with empty/default values. Tests override individual methods as needed.
  fs: {
    stat: vi.fn(() => Promise.resolve({ type: FileType.File, size: 0 })),
    readFile: vi.fn(() => Promise.resolve(new Uint8Array())),
    writeFile: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    readDirectory: vi.fn(() => Promise.resolve([])),
    createDirectory: vi.fn(() => Promise.resolve()),
    rename: vi.fn(() => Promise.resolve()),
    copy: vi.fn(() => Promise.resolve()),
  },
};

// ---------------------------------------------------------------------------
// Namespace: authentication
// ---------------------------------------------------------------------------
// The extension registers a custom AuthenticationProvider for Posit Connect
// API keys. This allows credentials to appear in VS Code's built-in Accounts
// menu and be shared with other extensions.

export const authentication = {
  // Registers the "posit-publisher" authentication provider.
  registerAuthenticationProvider: vi.fn(
    (..._args: any[]) => new Disposable(() => {}),
  ),
  // Retrieves an auth session — returns undefined (no session) by default.
  getSession: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
};

// ---------------------------------------------------------------------------
// Namespace: env
// ---------------------------------------------------------------------------
// Environment info and OS integration. The extension uses openExternal to
// launch Connect URLs in the browser and checks appName to detect whether
// it's running in VS Code vs Positron.

export const env = {
  openExternal: vi.fn((..._args: any[]) => Promise.resolve(true)),
  clipboard: { writeText: vi.fn((..._args: any[]) => Promise.resolve()) },
  appName: "Visual Studio Code",
};

// ---------------------------------------------------------------------------
// Namespace: lm (Language Model)
// ---------------------------------------------------------------------------
// VS Code's language model API for AI/LLM tool integration. The extension
// registers tools (via lm.registerTool) that allow Copilot and other LLM
// agents to invoke Publisher actions like deploying content.

export const lm = {
  registerTool: vi.fn((..._args: any[]) => new Disposable(() => {})),
};

// ---------------------------------------------------------------------------
// Namespace: l10n (Localization)
// ---------------------------------------------------------------------------
// VS Code's localization API. The extension uses l10n.t() to mark strings for
// translation. This mock passes the message through unchanged, which is
// sufficient for contract tests that assert on message content.

export const l10n = {
  t: vi.fn((message: string, ..._args: any[]) => message),
};

// ---------------------------------------------------------------------------
// Event emitter accessors (used by tests to fire events on the mock)
// ---------------------------------------------------------------------------
// These expose the internal EventEmitter instances so that tests can
// programmatically fire VS Code events. For example:
//
//   import { _testEmitters } from "vscode";
//   _testEmitters.onDidSaveTextDocument.fire(mockDocument);
//
// This simulates the user saving a file, which triggers the extension's
// document-save handler without needing a real VS Code editor.

export const _testEmitters = {
  onDidChangeActiveTextEditor: _onDidChangeActiveTextEditor,
  onDidChangeActiveNotebookEditor: _onDidChangeActiveNotebookEditor,
  onDidCloseTerminal: _onDidCloseTerminal,
  onDidGrantWorkspaceTrust: _onDidGrantWorkspaceTrust,
  onDidChangeWorkspaceFolders: _onDidChangeWorkspaceFolders,
  onDidCloseTextDocument: _onDidCloseTextDocument,
  onDidSaveTextDocument: _onDidSaveTextDocument,
  onDidCloseNotebookDocument: _onDidCloseNotebookDocument,
  onDidSaveNotebookDocument: _onDidSaveNotebookDocument,
};
