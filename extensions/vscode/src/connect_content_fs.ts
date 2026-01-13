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
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import tar from "tar-stream";

type ConnectContentEntry = {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
  data?: Uint8Array;
  children?: Map<string, ConnectContentEntry>;
};

const CONNECT_CONTENT_SCHEME = "connect-content";
const contentRoots = new Map<string, ConnectContentEntry>();
const fileChangeEmitter = new EventEmitter<FileChangeEvent[]>();

// Track which bundle contents back a Connect content URI.
export async function setConnectContentBundle(
  serverUrl: string,
  contentGuid: string,
  bundleBytes: Uint8Array,
) {
  contentRoots.set(
    connectContentUri(serverUrl, contentGuid).toString(),
    await extractBundleTree(bundleBytes),
  );
}

// Drop any cached bundle so reopening always fetches fresh content.
export function clearConnectContentBundle(
  serverUrl: string,
  contentGuid: string,
) {
  contentRoots.delete(connectContentUri(serverUrl, contentGuid).toString());
}

// Clear cached bundles when a connect-content workspace folder is removed.
export function clearConnectContentBundleForUri(uri: Uri) {
  if (uri.scheme !== CONNECT_CONTENT_SCHEME) {
    return;
  }
  contentRoots.delete(uri.toString());
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
    return Promise.resolve(statFromEntry(resolveEntry(uri)));
  }

  readDirectory(uri: Uri): Thenable<[string, FileType][]> {
    return Promise.resolve(listDirectory(resolveEntry(uri)));
  }

  readFile(uri: Uri): Thenable<Uint8Array> {
    const entry = resolveEntry(uri);
    if (entry.type !== FileType.File) {
      throw FileSystemError.FileIsADirectory(uri);
    }
    return Promise.resolve(entry.data ?? new Uint8Array());
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
}

function resolveEntry(uri: Uri): ConnectContentEntry {
  const trimmedPath = uri.path.replace(/^\/+/, "");
  const [contentGuid, ...rest] = trimmedPath.split("/");
  if (!contentGuid) {
    throw FileSystemError.FileNotFound(uri);
  }
  const root = contentRoots.get(
    // Resolve the workspace root URI so every file path maps to the same bundle cache.
    uri.with({ path: `/${contentGuid}` }).toString(),
  );
  if (!root) {
    throw FileSystemError.FileNotFound(uri);
  }
  if (rest.length === 0) {
    return root;
  }
  let current = root;
  for (const segment of rest) {
    if (!current.children) {
      throw FileSystemError.FileNotFound(uri);
    }
    const next = current.children.get(segment);
    if (!next) {
      throw FileSystemError.FileNotFound(uri);
    }
    current = next;
  }
  return current;
}

function listDirectory(entry: ConnectContentEntry): [string, FileType][] {
  if (entry.type !== FileType.Directory) {
    throw FileSystemError.FileNotADirectory();
  }
  return [...(entry.children ?? new Map()).entries()].map(([name, child]) => [
    name,
    child.type,
  ]);
}

function statFromEntry(entry: ConnectContentEntry): FileStat {
  return {
    type: entry.type,
    ctime: entry.ctime,
    mtime: entry.mtime,
    size: entry.size,
  };
}

async function extractBundleTree(bundleBytes: Uint8Array) {
  // Materialize the bundle so the file system can serve reads without touching disk.
  const root = createDirectoryEntry();
  const extract = tar.extract();
  extract.on(
    "entry",
    (header: tar.Headers, stream: NodeJS.ReadableStream, next: () => void) => {
      const parts = normalizeEntryPath(header.name);
      if (parts.length === 0) {
        stream.resume();
        next();
        return;
      }
      if (header.type === "directory") {
        ensureDirectory(root, parts, header.mtime);
        stream.resume();
        next();
        return;
      }
      if (header.type !== "file") {
        stream.resume();
        next();
        return;
      }
      const buffers: Uint8Array[] = [];
      stream.on("data", (chunk: Uint8Array) => {
        buffers.push(chunk);
      });
      stream.on("end", () => {
        const fileEntry = createFileEntry(Buffer.concat(buffers), header.mtime);
        const name = parts.at(-1);
        if (!name) {
          next();
          return;
        }
        ensureDirectory(root, parts.slice(0, -1), header.mtime).children?.set(
          name,
          fileEntry,
        );
        next();
      });
    },
  );
  await pipeline(Readable.from(bundleBytes), createGunzip(), extract);
  return root;
}

function createDirectoryEntry(mtime?: Date): ConnectContentEntry {
  const timestamp = (mtime ?? new Date()).getTime();
  return {
    type: FileType.Directory,
    ctime: timestamp,
    mtime: timestamp,
    size: 0,
    children: new Map(),
  };
}

function createFileEntry(data: Uint8Array, mtime?: Date): ConnectContentEntry {
  const timestamp = (mtime ?? new Date()).getTime();
  return {
    type: FileType.File,
    ctime: timestamp,
    mtime: timestamp,
    size: data.length,
    data,
  };
}

function ensureDirectory(
  root: ConnectContentEntry,
  parts: string[],
  mtime?: Date,
) {
  let current = root;
  for (const part of parts) {
    if (!current.children) {
      current.children = new Map();
    }
    const existing = current.children.get(part);
    if (existing?.type === FileType.Directory) {
      current = existing;
      continue;
    }
    const created = createDirectoryEntry(mtime);
    current.children.set(part, created);
    current = created;
  }
  return current;
}

function normalizeEntryPath(name: string) {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..");
}

function connectContentAuthority(serverUrl: string) {
  return new URL(serverUrl).host;
}
