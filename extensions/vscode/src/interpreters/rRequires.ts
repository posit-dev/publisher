// Copyright (C) 2026 by Posit Software, PBC.

import { Uri, workspace } from "vscode";
import { adaptToCompatibleConstraint } from "./versionConstraints";

/**
 * Find the R version requested by the project, checking in order:
 * 1. DESCRIPTION file (Depends: R (>= x.y.z))
 * 2. renv.lock (R.Version)
 *
 * Returns the version specification, or empty string if not found.
 */
export async function getRRequires(projectDir: string): Promise<string> {
  const baseUri = Uri.file(projectDir);

  const fromDescription = await readDescriptionFile(baseUri);
  if (fromDescription) {
    return fromDescription;
  }

  const fromRenvLock = await readRenvLock(baseUri);
  if (fromRenvLock) {
    return fromRenvLock;
  }

  return "";
}

async function readFileText(uri: Uri): Promise<string | null> {
  try {
    const data = await workspace.fs.readFile(uri);
    return new TextDecoder().decode(data);
  } catch {
    return null;
  }
}

/**
 * Read DESCRIPTION file and look for R version in the Depends: section.
 * Matches patterns like "R (>= 3.5.0)".
 */
async function readDescriptionFile(baseUri: Uri): Promise<string | undefined> {
  const fileUri = Uri.joinPath(baseUri, "DESCRIPTION");
  const content = await readFileText(fileUri);
  if (content === null) {
    return undefined;
  }

  const lines = content.split("\n");
  const deps: string[] = [];
  let found = false;

  for (const line of lines) {
    if (line.startsWith("Depends:")) {
      deps.push(line.substring("Depends:".length));
      found = true;
    } else if (found && (line.startsWith(" ") || line.startsWith("\t"))) {
      deps.push(line.trim());
    } else if (found) {
      break;
    }
  }

  const all = deps.join(" ");
  const re = /\bR\s*\(([^)]+)\)/;
  const match = re.exec(all);
  if (match && match[1]) {
    return match[1];
  }

  return undefined;
}

/**
 * Read renv.lock (JSON) and extract R.Version, converting it to a
 * compatible constraint via adaptToCompatibleConstraint.
 */
async function readRenvLock(baseUri: Uri): Promise<string | undefined> {
  const fileUri = Uri.joinPath(baseUri, "renv.lock");
  const content = await readFileText(fileUri);
  if (content === null) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(content);
    const version = parsed?.R?.Version;
    if (typeof version === "string" && version) {
      return adaptToCompatibleConstraint(version);
    }
  } catch {
    // Invalid JSON, ignore
  }

  return undefined;
}
