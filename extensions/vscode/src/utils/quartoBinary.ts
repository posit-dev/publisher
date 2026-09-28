// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { access, constants, stat } from "fs/promises";

// Returns the bin directory (or executable) of the Quarto CLI the Quarto
// extension selected, if that extension is installed and found one.
export type QuartoExtensionLookup = () => Promise<string | undefined>;

let quartoExtensionLookup: QuartoExtensionLookup | undefined;

// Positron ships its own Quarto under `<appRoot>/quarto/bin`, but only puts it
// on PATH inside its integrated terminals, so the extension host's PATH
// usually can't see it.
let bundledQuartoDir: string | undefined;

// Called at activation. Kept as a setter so this module (and the detectors
// that use it) don't depend on the vscode API.
export function configureQuartoLookup(opts: {
  appRoot?: string;
  quartoExtensionLookup?: QuartoExtensionLookup;
}) {
  bundledQuartoDir = opts.appRoot
    ? path.join(opts.appRoot, "quarto", "bin")
    : undefined;
  quartoExtensionLookup = opts.quartoExtensionLookup;
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

async function isExecutableFile(file: string): Promise<boolean> {
  try {
    await access(file, constants.X_OK);
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function findInDir(dir: string): Promise<string | undefined> {
  for (const name of executableNames()) {
    const candidate = path.join(dir, name);
    if (await isExecutableFile(candidate)) {
      return candidate;
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

async function fromQuartoExtension(): Promise<string | undefined> {
  if (!quartoExtensionLookup) {
    return undefined;
  }
  try {
    const quartoPath = await quartoExtensionLookup();
    if (!quartoPath) {
      return undefined;
    }
    // getQuartoPath() returns the bin directory today, but its docs describe
    // it as the path to the binary, so accept the executable itself too.
    if (await isExecutableFile(quartoPath)) {
      return quartoPath;
    }
    return await findInDir(quartoPath);
  } catch {
    return undefined;
  }
}

// Returns the command to invoke Quarto with. In order of preference:
//   1. The Quarto extension's choice, which honors its `quarto.path`,
//      `quarto.usePipQuarto`, and `quarto.useBundledQuartoInPositron` settings
//      and searches known install locations.
//   2. "quarto", when it's on PATH.
//   3. Positron's bundled binary.
// Falls back to "quarto" so callers still get the usual ENOENT when none
// exists.
export async function resolveQuartoBinary(): Promise<string> {
  const fromExtension = await fromQuartoExtension();
  if (fromExtension) {
    return fromExtension;
  }
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
