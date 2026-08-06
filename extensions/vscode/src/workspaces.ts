// Copyright (C) 2024 by Posit Software, PBC.

import nodePath from "path";
import { workspace } from "vscode";

export const path = (): string | undefined => {
  return workspace.workspaceFolders?.at(0)?.uri.fsPath;
};

export type ResolvedWorkspacePath =
  { ok: true; absPath: string } | { ok: false; error: string };

/**
 * Resolve a (possibly untrusted, e.g. agent-supplied) relative directory
 * against the workspace root, rejecting any path that escapes the
 * workspace via ".." segments or an absolute path. Callers must run this
 * before reading or writing any file derived from the directory.
 */
export function resolveWithinWorkspace(
  root: string,
  relDir: string,
): ResolvedWorkspacePath {
  const absPath = nodePath.resolve(root, relDir);
  const rel = nodePath.relative(root, absPath);
  // We can't just check rel.startsWith("..") because a directory literally
  // named ".." would be a false positive.
  if (
    rel === ".." ||
    rel.startsWith(".." + nodePath.sep) ||
    nodePath.isAbsolute(rel)
  ) {
    return { ok: false, error: "Project directory is outside the workspace." };
  }
  return { ok: true, absPath };
}
