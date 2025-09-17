// Copyright (C) 2025 by Posit Software, PBC.

import { workspace } from "vscode";
import type { PositronSettings } from "src/api";

// Returns Positron repo settings derived from VS Code configuration.
// - Always includes r.defaultRepositories (defaults to "auto").
// - Adds r.packageManagerRepository only when defaultRepositories === "auto" and the repo is set.
export function getPositronRepoSettings(): PositronSettings {
  const cfg = workspace.getConfiguration("positron.r");
  const defaultRepos = (
    cfg.get<string>("defaultRepositories") || "auto"
  ).trim();
  const ppmRepo = (cfg.get<string>("packageManagerRepository") || "").trim();

  return {
    r: {
      defaultRepositories: defaultRepos,
      ...(defaultRepos === "auto" && ppmRepo
        ? { packageManagerRepository: ppmRepo }
        : {}),
    },
  };
}
