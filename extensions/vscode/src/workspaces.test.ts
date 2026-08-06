// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi } from "vitest";
import path from "path";

vi.mock("vscode", () => ({ workspace: { workspaceFolders: undefined } }));

import { resolveWithinWorkspace } from "./workspaces";

describe("resolveWithinWorkspace", () => {
  const root = path.join(path.sep, "root");

  test("resolves a plain relative directory", () => {
    expect(resolveWithinWorkspace(root, "sub/dir")).toEqual({
      ok: true,
      absPath: path.join(root, "sub", "dir"),
    });
  });

  test("resolves the root itself", () => {
    expect(resolveWithinWorkspace(root, ".")).toEqual({
      ok: true,
      absPath: root,
    });
  });

  test("rejects a relative path that escapes the workspace with ..", () => {
    expect(resolveWithinWorkspace(root, "../../etc")).toEqual({
      ok: false,
      error: "Project directory is outside the workspace.",
    });
  });

  test("rejects an absolute path outside the workspace", () => {
    expect(
      resolveWithinWorkspace(root, path.join(path.sep, "etc", "passwd")),
    ).toEqual({
      ok: false,
      error: "Project directory is outside the workspace.",
    });
  });

  test("allows a directory literally named ..foo (not a traversal)", () => {
    expect(resolveWithinWorkspace(root, "..foo")).toEqual({
      ok: true,
      absPath: path.join(root, "..foo"),
    });
  });
});
