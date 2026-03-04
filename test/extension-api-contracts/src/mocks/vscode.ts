// Copyright (C) 2026 by Posit Software, PBC.

// Comprehensive mock of the "vscode" module for contract tests.
// All exported names mirror the real vscode API so that extension source
// files can be imported without modification.

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export enum QuickInputButtons {
  Back = "Back",
}

// ---------------------------------------------------------------------------
// Constructors / Classes
// ---------------------------------------------------------------------------

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

export const Uri = {
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

export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: ThemeColor,
  ) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class RelativePattern {
  constructor(
    public readonly base: any,
    public readonly pattern: string,
  ) {}
}

export class TreeItem {
  label?: string;
  collapsibleState?: TreeItemCollapsibleState;
  constructor(
    label: string,
    collapsibleState?: TreeItemCollapsibleState,
  ) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

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

const _onDidChangeActiveTextEditor = new EventEmitter<any>();
const _onDidChangeActiveNotebookEditor = new EventEmitter<any>();
const _onDidCloseTerminal = new EventEmitter<any>();

export const window = {
  showErrorMessage: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  showInformationMessage: vi.fn(
    (..._args: any[]) => Promise.resolve(undefined),
  ),
  showWarningMessage: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  showInputBox: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  withProgress: vi.fn(
    (_options: any, task: (progress: any, token: any) => Promise<any>) =>
      task(
        { report: vi.fn() },
        { isCancellationRequested: false, onCancellationRequested: vi.fn() },
      ),
  ),
  createTerminal: vi.fn(() => ({
    sendText: vi.fn(),
    show: vi.fn(),
    exitStatus: { code: 0 },
    dispose: vi.fn(),
  })),
  createTreeView: vi.fn(() => ({
    onDidChangeSelection: vi.fn(),
    onDidExpandElement: vi.fn(),
    onDidCollapseElement: vi.fn(),
    onDidChangeVisibility: vi.fn(),
    dispose: vi.fn(),
    reveal: vi.fn(),
  })),
  showTextDocument: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
  registerUriHandler: vi.fn((_handler: any) => new Disposable(() => {})),
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

const mockConfigGet = vi.fn((_key?: string) => undefined);
const mockGetConfiguration = vi.fn((_section?: string) => ({
  get: mockConfigGet,
  has: vi.fn(() => false),
  inspect: vi.fn(() => undefined),
  update: vi.fn(() => Promise.resolve()),
}));

const _onDidGrantWorkspaceTrust = new EventEmitter<void>();
const _onDidChangeWorkspaceFolders = new EventEmitter<any>();
const _onDidCloseTextDocument = new EventEmitter<any>();
const _onDidSaveTextDocument = new EventEmitter<any>();
const _onDidCloseNotebookDocument = new EventEmitter<any>();
const _onDidSaveNotebookDocument = new EventEmitter<any>();

const mockFileSystemWatcher = () => ({
  onDidCreate: vi.fn(() => new Disposable(() => {})),
  onDidChange: vi.fn(() => new Disposable(() => {})),
  onDidDelete: vi.fn(() => new Disposable(() => {})),
  dispose: vi.fn(),
});

export const workspace = {
  getConfiguration: mockGetConfiguration,
  workspaceFolders: [
    {
      uri: { fsPath: "/workspace", path: "/workspace", scheme: "file" },
      name: "workspace",
      index: 0,
    },
  ] as any[],
  isTrusted: true,
  onDidGrantWorkspaceTrust: vi.fn((listener: any) =>
    _onDidGrantWorkspaceTrust.event(listener),
  ),
  onDidChangeWorkspaceFolders: vi.fn((listener: any) =>
    _onDidChangeWorkspaceFolders.event(listener),
  ),
  updateWorkspaceFolders: vi.fn(
    (..._args: any[]) => true,
  ),
  createFileSystemWatcher: vi.fn((..._args: any[]) => mockFileSystemWatcher()),
  registerFileSystemProvider: vi.fn(
    (..._args: any[]) => new Disposable(() => {}),
  ),
  openTextDocument: vi.fn((..._args: any[]) => Promise.resolve({})),
  onDidCloseTextDocument: vi.fn((listener: any, thisArg?: any) =>
    _onDidCloseTextDocument.event(
      thisArg ? listener.bind(thisArg) : listener,
    ),
  ),
  onDidSaveTextDocument: vi.fn((listener: any, thisArg?: any) =>
    _onDidSaveTextDocument.event(
      thisArg ? listener.bind(thisArg) : listener,
    ),
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

export const authentication = {
  registerAuthenticationProvider: vi.fn(
    (..._args: any[]) => new Disposable(() => {}),
  ),
  getSession: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
};

// ---------------------------------------------------------------------------
// Namespace: env
// ---------------------------------------------------------------------------

export const env = {
  openExternal: vi.fn((..._args: any[]) => Promise.resolve(true)),
  clipboard: { writeText: vi.fn((..._args: any[]) => Promise.resolve()) },
  appName: "Visual Studio Code",
};

// ---------------------------------------------------------------------------
// Namespace: lm
// ---------------------------------------------------------------------------

export const lm = {
  registerTool: vi.fn((..._args: any[]) => new Disposable(() => {})),
};

// ---------------------------------------------------------------------------
// Namespace: l10n
// ---------------------------------------------------------------------------

export const l10n = {
  t: vi.fn((message: string, ..._args: any[]) => message),
};

// ---------------------------------------------------------------------------
// Event emitter accessors (used by tests to fire events on the mock)
// ---------------------------------------------------------------------------

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
