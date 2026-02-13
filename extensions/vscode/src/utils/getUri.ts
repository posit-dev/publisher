// Copyright (C) 2024 by Posit Software, PBC.

import {
  Tab,
  TabInputCustom,
  TabInputNotebook,
  TabInputText,
  TabInputTextDiff,
  Uri,
  Webview,
} from "vscode";

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(
  webview: Webview,
  extensionUri: Uri,
  pathList: string[],
) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

/**
 * Gets the file URI from any tab input type (text, notebook, custom, diff).
 * Returns undefined for unsupported tab types.
 *
 * @param tab The tab to extract the file URI from
 * @returns The file URI, or undefined if unsupported
 */
export function getFileUriFromTab(tab: Tab): Uri | undefined {
  const input = tab.input;
  let uri: Uri | undefined;

  if (input instanceof TabInputText) {
    uri = input.uri;
  } else if (input instanceof TabInputNotebook) {
    uri = input.uri;
  } else if (input instanceof TabInputCustom) {
    uri = input.uri;
  } else if (input instanceof TabInputTextDiff) {
    // Use the modified file for diff views
    uri = input.modified;
  }

  if (!uri) {
    return undefined;
  }

  // Resolve special URI schemes (git, vscode-*) to file URIs
  if (uri.scheme === "file") {
    return uri;
  }
  if (uri.scheme === "git" || uri.scheme.startsWith("vscode-")) {
    try {
      return Uri.file(uri.fsPath);
    } catch {
      return undefined;
    }
  }
  // Untitled documents are not saved files
  if (uri.scheme === "untitled") {
    return undefined;
  }
  return undefined;
}
