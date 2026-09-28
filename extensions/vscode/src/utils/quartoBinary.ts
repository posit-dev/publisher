// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { access, constants } from "fs/promises";

// Positron ships its own Quarto under `<appRoot>/quarto/bin`, but only puts it
// on PATH inside its integrated terminals, so the extension host's PATH
// usually can't see it. This mirrors how the Quarto extension locates it.
let bundledQuartoDir: string | undefined;

// Called at activation with `vscode.env.appRoot`. Kept as a setter so this
// module (and the detectors that use it) don't depend on the vscode API.
export function setQuartoAppRoot(appRoot: string | undefined) {
  bundledQuartoDir = appRoot ? path.join(appRoot, "quarto", "bin") : undefined;
}

function executableNames(): string[] {
  if (process.platform !== "win32") {
    return ["quarto"];
  }
  const exts = (process.env.PATHEXT || ".EXE;.CMD;.BAT")
    .split(";")
    .filter(Boolean);
  return exts.map((ext) => "quarto" + ext.toLowerCase());
}

async function findInDir(dir: string): Promise<string | undefined> {
  for (const name of executableNames()) {
    const candidate = path.join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // not here
    }
  }
  return undefined;
}

async function isOnPath(): Promise<boolean> {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    if (await findInDir(dir)) {
      return true;
    }
  }
  return false;
}

// Returns the command to invoke Quarto with: "quarto" when it's on PATH,
// otherwise the absolute path to Positron's bundled binary if present. Falls
// back to "quarto" so callers still get the usual ENOENT when none exists.
export async function resolveQuartoBinary(): Promise<string> {
  if (await isOnPath()) {
    return "quarto";
  }
  if (bundledQuartoDir) {
    const bundled = await findInDir(bundledQuartoDir);
    if (bundled) {
      return bundled;
    }
  }
  return "quarto";
}
