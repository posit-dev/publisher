// Copyright (C) 2024 by Posit Software, PBC.

import { Uri, workspace } from 'vscode';

export async function fileExists(fileUri: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(fileUri);
    return true;
  } catch (e: any) {
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
