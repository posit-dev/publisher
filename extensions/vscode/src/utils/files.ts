// Copyright (C) 2024 by Posit Software, PBC.

import { Uri, workspace } from 'vscode';

export async function fileExists(fileUri: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(fileUri);
    return true;
  } catch (e: unknown) {
    return false;
  }
}

export function ensureSuffix(suffix: string, filename: string): string {
  if (filename.endsWith(suffix)) {
    return filename;
  } else {
    return filename + suffix;
  }
}

export function isValidFilename(filename: string): boolean {
  if (filename === "." || filename.includes("..")) {
    return false;
  }
  const forbidden = '/:\*?"<>|';
  for (let c of filename) {
    if (forbidden.includes(c)) {
      return false;
    }
    const codePoint = c.codePointAt(0);
    if (codePoint === undefined || codePoint < 32) {
      return false;
    }
  }
  return true;
}
