// Copyright (C) 2026 by Posit Software, PBC.

import {
  Disposable,
  EventEmitter,
  FileChangeEvent,
  FileStat,
  FileSystemError,
  FileSystemProvider,
  FileType,
  Uri,
  workspace,
} from "vscode";
import path from "path";

const CONNECT_CONTENT_SCHEME = "connect-content";
const contentRoots = new Map<string, string>();
const fileChangeEmitter = new EventEmitter<FileChangeEvent[]>();

// Track which local workspace root backs a Connect content URI.
export function setConnectContentRoot(
  serverUrl: string,
  contentGuid: string,
  localPath: string,
) {
  contentRoots.set(`${connectContentAuthority(serverUrl)}/${contentGuid}`, localPath);
}

// Construct the Connect content URI that the extension opens in VS Code.
export function connectContentUri(serverUrl: string, contentGuid: string) {
  return Uri.from({
    scheme: CONNECT_CONTENT_SCHEME,
    authority: connectContentAuthority(serverUrl),
    path: `/${contentGuid}`,
  });
}

// Register a read-only file system so VS Code can browse Connect content.
export function registerConnectContentFileSystem(): Disposable {
  return workspace.registerFileSystemProvider(
    CONNECT_CONTENT_SCHEME,
    new ConnectContentFileSystemProvider(),
    { isReadonly: true },
  );
}

class ConnectContentFileSystemProvider implements FileSystemProvider {
  onDidChangeFile = fileChangeEmitter.event;

  watch(): Disposable {
    return new Disposable(() => undefined);
  }

  stat(uri: Uri): Thenable<FileStat> {
    return workspace.fs.stat(Uri.file(this.resolveLocalPath(uri)));
  }

  readDirectory(uri: Uri): Thenable<[string, FileType][]> {
    return workspace.fs.readDirectory(Uri.file(this.resolveLocalPath(uri)));
  }

  readFile(uri: Uri): Thenable<Uint8Array> {
    return workspace.fs.readFile(Uri.file(this.resolveLocalPath(uri)));
  }

  createDirectory(): void {
    throw FileSystemError.NoPermissions("connect-content is read-only");
  }

  writeFile(): void {
    throw FileSystemError.NoPermissions("connect-content is read-only");
  }

  delete(): void {
    throw FileSystemError.NoPermissions("connect-content is read-only");
  }

  rename(): void {
    throw FileSystemError.NoPermissions("connect-content is read-only");
  }

  private resolveLocalPath(uri: Uri): string {
    const trimmedPath = uri.path.replace(/^\/+/, "");
    const [contentGuid, ...rest] = trimmedPath.split("/");
    const root = contentRoots.get(`${uri.authority}/${contentGuid}`);
    if (!root) {
      throw FileSystemError.FileNotFound(
        `No local workspace for ${uri.authority}/${contentGuid}`,
      );
    }
    return path.join(root, ...rest);
  }
}

function connectContentAuthority(serverUrl: string) {
  return new URL(serverUrl).host;
}
