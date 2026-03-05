// Copyright (C) 2026 by Posit Software, PBC.

// Compile-time conformance check: validates that every property in our vscode
// mock also exists in the real @types/vscode API. If the mock includes a
// property that doesn't exist in the real API (a "phantom"), TypeScript will
// produce a compile error on the corresponding Pick<> line.
//
// Run:  npm run check:conformance
//   or: npx tsc --noEmit -p tsconfig.conformance.json
//
// This uses a separate tsconfig (tsconfig.conformance.json) that does NOT alias
// "vscode" to our mock, so `import type * as vscode from "vscode"` resolves to
// the real @types/vscode definitions while `import * as mock from "./vscode"`
// resolves to our mock file.
//
// How it works:
//   Pick<RealType, keyof MockType>
// If MockType has a key "foo" that doesn't exist in RealType, TypeScript errors:
//   Type '"foo"' does not satisfy the constraint 'keyof RealType'.
//
// What this catches:
// - Misspelled method/property names in the mock
// - Methods removed from the real API in newer @types/vscode versions
// - Accidentally invented APIs that don't exist in VS Code
//
// What this does NOT check:
// - Function signature compatibility (vi.fn() mocks have different types)
// - Mock completeness (the mock only covers APIs the extension uses)
// - Enum numeric values (verified visually against VS Code docs)

import type * as vscode from "vscode";
import type * as mock from "./vscode";

// ---------------------------------------------------------------------------
// Namespace key checks
// ---------------------------------------------------------------------------
// Each line verifies that every key in the mock namespace object also exists
// in the corresponding real vscode namespace.

type _Commands = Pick<typeof vscode.commands, keyof typeof mock.commands>;
type _Window = Pick<typeof vscode.window, keyof typeof mock.window>;
type _Workspace = Pick<typeof vscode.workspace, keyof typeof mock.workspace>;
type _Auth = Pick<
  typeof vscode.authentication,
  keyof typeof mock.authentication
>;
type _Env = Pick<typeof vscode.env, keyof typeof mock.env>;
type _Lm = Pick<typeof vscode.lm, keyof typeof mock.lm>;
type _L10n = Pick<typeof vscode.l10n, keyof typeof mock.l10n>;

// ---------------------------------------------------------------------------
// Nested object key checks
// ---------------------------------------------------------------------------
// For mock objects with nested structure, verify the inner keys too.

type _WorkspaceFs = Pick<
  typeof vscode.workspace.fs,
  keyof typeof mock.workspace.fs
>;
type _EnvClipboard = Pick<
  typeof vscode.env.clipboard,
  keyof typeof mock.env.clipboard
>;
type _TabGroups = Pick<
  typeof vscode.window.tabGroups,
  keyof typeof mock.window.tabGroups
>;

// ---------------------------------------------------------------------------
// Static method / factory key checks
// ---------------------------------------------------------------------------
// Uri and FileSystemError are classes in the real API with static methods.
// Our mock replicates the static surface as plain objects.

type _Uri = Pick<typeof vscode.Uri, keyof typeof mock.Uri>;
type _FsError = Pick<
  typeof vscode.FileSystemError,
  keyof typeof mock.FileSystemError
>;

// ---------------------------------------------------------------------------
// Enum member checks
// ---------------------------------------------------------------------------
// Verify that every member in our mock enums exists in the real enums.

type _TreeItemState = Pick<
  typeof vscode.TreeItemCollapsibleState,
  keyof typeof mock.TreeItemCollapsibleState
>;
type _FileType = Pick<typeof vscode.FileType, keyof typeof mock.FileType>;
type _ProgressLoc = Pick<
  typeof vscode.ProgressLocation,
  keyof typeof mock.ProgressLocation
>;
type _ExtMode = Pick<
  typeof vscode.ExtensionMode,
  keyof typeof mock.ExtensionMode
>;
type _QuickInputBtns = Pick<
  typeof vscode.QuickInputButtons,
  keyof typeof mock.QuickInputButtons
>;

// ---------------------------------------------------------------------------
// Class existence checks
// ---------------------------------------------------------------------------
// Verify the classes we mock exist in the real API. These are type-only
// references — if VS Code removed a class, the corresponding line would error.

type _DisposableClass = typeof vscode.Disposable;
type _EventEmitterClass = typeof vscode.EventEmitter;
type _ThemeIconClass = typeof vscode.ThemeIcon;
type _ThemeColorClass = typeof vscode.ThemeColor;
type _RelativePatternClass = typeof vscode.RelativePattern;
type _TreeItemClass = typeof vscode.TreeItem;
type _RangeClass = typeof vscode.Range;
type _PositionClass = typeof vscode.Position;
