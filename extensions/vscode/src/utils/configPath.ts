// Copyright (C) 2026 by Posit Software, PBC.

import path from "path";

/**
 * Compute the configuration file path (relative to workspace root)
 * from a projectDir and configuration name.
 */
export function configurationPath(projectDir: string, name: string): string {
  return path.join(projectDir, ".posit", "publish", `${name}.toml`);
}
