// Copyright (C) 2024 by Posit Software, PBC.

import {
  Position,
  Uri,
  WorkspaceEdit,
  workspace,
  window,
  commands,
} from "vscode";

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
  const forbidden = "/:*?\"<>|'\\";
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

export async function viewFileInPreview(uri: Uri, moveCursorToEnd = true) {
  const doc = await workspace.openTextDocument(uri);
  if (moveCursorToEnd) {
    await commands.executeCommand("cursorMove", {
      to: "down",
      by: "line",
      value: doc.lineCount - 1,
    });
  }
  await window.showTextDocument(doc, { preview: true });
}

export async function openNewOrExistingFileInPreview(
  filePath: string,
  newFileContents: string,
  appendedContents?: string,
) {
  let fileExist = true;
  const existingUri = Uri.parse(filePath);
  const newUri = Uri.file(filePath).with({ scheme: "untitled" });

  try {
    await workspace.fs.stat(existingUri);
  } catch {
    fileExist = false;
  }

  const doc = await workspace.openTextDocument(
    fileExist ? existingUri : newUri,
  );
  const wsedit = new WorkspaceEdit();
  if (!fileExist) {
    // insert our template
    wsedit.insert(newUri, new Position(0, 0), newFileContents);
  }
  // append contents
  if (appendedContents) {
    const lastLine = doc.lineAt(doc.lineCount - 1);
    wsedit.insert(
      fileExist ? existingUri : newUri,
      new Position(lastLine.lineNumber, 0),
      appendedContents,
    );
  }
  await workspace.applyEdit(wsedit);
  viewFileInPreview(fileExist ? existingUri : newUri);

  await window.showTextDocument(doc, { preview: true });
  await commands.executeCommand("cursorMove", {
    to: "down",
    by: "line",
    value: doc.lineCount - 1,
  });
}

export async function updateNewOrExistingFile(
  filePath: string,
  newFileContents: string,
  appendedContents?: string,
  openEditor = false,
) {
  let fileExist = true;
  const uri = Uri.parse(filePath);

  try {
    await workspace.fs.stat(uri);
    await workspace.openTextDocument(uri);
  } catch {
    fileExist = false;
  }

  let fileContents: Uint8Array;
  if (fileExist) {
    fileContents = await workspace.fs.readFile(uri);
  } else {
    fileContents = new TextEncoder().encode(newFileContents);
  }
  if (appendedContents) {
    const extra = new TextEncoder().encode(appendedContents);
    const newContents = new Uint8Array(fileContents.length + extra.length);
    newContents.set(fileContents);
    newContents.set(extra, fileContents.length);
    fileContents = newContents;
  }

  await workspace.fs.writeFile(uri, fileContents);

  if (openEditor) {
    viewFileInPreview(uri);
  }
}

// Path Sorting was inspired by:
// https://github.com/hughsk/path-sort
// Very old, but MIT license
//
// Suggest this method to determine the separator to pass in
// Not performing it here, because we might be displaying paths from a source
// which is not the same platform that the client is running on.
//   import * as os from 'os'
//   const sep: string = (os.platform() === 'win32') ? '\\' : '/';

export function pathSort(paths: string[], sep: string): string[] {
  return paths
    .map((el: string) => {
      return el.split(sep);
    })
    .sort(pathSorter)
    .map((el: string[]) => {
      return el.join(sep);
    });
}

export function pathSorter(a: string[], b: string[]): number {
  var l = Math.max(a.length, b.length);
  for (var i = 0; i < l; i += 1) {
    if (!(i in a)) {
      return -1;
    }
    if (!(i in b)) {
      return +1;
    }
    if (a[i].toUpperCase() > b[i].toUpperCase()) {
      return +1;
    }
    if (a[i].toUpperCase() < b[i].toUpperCase()) {
      return -1;
    }
    if (a.length < b.length) {
      return -1;
    }
    if (a.length > b.length) {
      return +1;
    }
  }
  return 0;
}

// Sort factory function to sort two paths
export function standalonePathSorter(sep: string) {
  return (a: string, b: string) => {
    return pathSorter(a.split(sep), b.split(sep));
  };
}
