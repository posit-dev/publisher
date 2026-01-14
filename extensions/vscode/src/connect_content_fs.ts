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
  window,
  workspace,
} from "vscode";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import tar from "tar-stream";
import { useApi } from "./api";
import { authLogger } from "./authProvider";
import { isAxiosError } from "axios";

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
const bundleFetches = new Map<string, Promise<void>>();

// Track which bundle contents back a Connect content URI.
// Drop any cached bundle so reopening always fetches fresh content.
export function clearConnectContentBundle(
  serverUrl: string,
  contentGuid: string,
) {
  authLogger.info(`Clearing cached bundle ${contentGuid} for ${serverUrl}`);
  contentRoots.delete(connectContentUri(serverUrl, contentGuid).toString());
  bundleFetches.delete(connectContentUri(serverUrl, contentGuid).toString());
}

// Clear cached bundles when a connect-content workspace folder is removed.
export function clearConnectContentBundleForUri(uri: Uri) {
  if (uri.scheme !== CONNECT_CONTENT_SCHEME) {
    return;
  }
  authLogger.info(
    `Clearing bundle cache for removed workspace ${uri.toString()}`,
  );
  contentRoots.delete(uri.toString());
  bundleFetches.delete(uri.toString());
}

// Construct the Connect content URI that the extension opens in VS Code.
export function connectContentUri(serverUrl: string, contentGuid: string) {
  const query = new URLSearchParams({ serverUrl }).toString();
  const authority = tryGetHost(serverUrl);
  return Uri.from({
    scheme: CONNECT_CONTENT_SCHEME,
    authority,
    path: `/${contentGuid}`,
    query,
  });
}

// Register a read-only file system so VS Code can browse Connect content.
export function registerConnectContentFileSystem(): Disposable {
  authLogger.info("Registering connect-content file system provider");
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

  async stat(uri: Uri): Promise<FileStat> {
    authLogger.info(`connect-content stat ${uri.toString()}`);
    const entry = await resolveEntry(uri);
    return statFromEntry(entry);
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    authLogger.info(`connect-content readDirectory ${uri.toString()}`);
    const entry = await resolveEntry(uri);
    return listDirectory(entry);
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    authLogger.info(`connect-content readFile ${uri.toString()}`);
    const entry = await resolveEntry(uri);
    if (entry.type !== FileType.File) {
      throw FileSystemError.FileIsADirectory(uri);
    }
    return entry.data ?? new Uint8Array();
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

async function resolveEntry(uri: Uri): Promise<ConnectContentEntry> {
  await ensureBundleForUri(uri);
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
    authLogger.error(`No cached bundle for ${uri.toString()}`);
    throw FileSystemError.FileNotFound(uri);
  }
  authLogger.info(
    `Resolved connect-content entry for ${uri.toString()} ${
      rest.length ? `(descended ${rest.length} segments)` : "(root)"
    }`,
  );
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

function parseConnectContentUri(uri: Uri) {
  if (uri.scheme !== CONNECT_CONTENT_SCHEME) {
    return null;
  }
  const params = new URLSearchParams(uri.query);
  const serverUrl = params.get("serverUrl");
  if (!serverUrl) {
    return null;
  }
  const trimmedPath = uri.path.replace(/^\/+/, "");
  const [contentGuid] = trimmedPath.split("/");
  if (!contentGuid) {
    return null;
  }
  if (!isValidOrigin(serverUrl)) {
    return null;
  }
  return { serverUrl, contentGuid };
}

function tryGetHost(serverUrl: string) {
  try {
    return new URL(serverUrl).host;
  } catch {
    return "";
  }
}

function isValidOrigin(serverUrl: string) {
  try {
    new URL(serverUrl);
    return true;
  } catch {
    return false;
  }
}

async function ensureBundleForUri(uri: Uri): Promise<void> {
  const parsed = parseConnectContentUri(uri);
  if (!parsed) {
    throw FileSystemError.FileNotFound(uri);
  }
  const rootKey = uri.with({ path: `/${parsed.contentGuid}` }).toString();
  if (contentRoots.has(rootKey)) {
    return;
  }
  let pending = bundleFetches.get(rootKey);
  if (!pending) {
    pending = fetchAndCacheBundle(
      parsed.serverUrl,
      parsed.contentGuid,
      rootKey,
    );
    bundleFetches.set(rootKey, pending);
  }
  try {
    await pending;
  } finally {
    bundleFetches.delete(rootKey);
  }
}

async function fetchAndCacheBundle(
  serverUrl: string,
  contentGuid: string,
  rootKey: string,
) {
  const api = await useApi();
  try {
    const response = await api.openConnectContent.openConnectContent(
      serverUrl,
      contentGuid,
    );
    const bundleBytes = new Uint8Array(response.data);
    const root = await extractBundleTree(bundleBytes);
    contentRoots.set(rootKey, root);
    authLogger.info(
      `Fetched bundle ${contentGuid} for ${serverUrl} and cached for ${rootKey}`,
    );
  } catch (error) {
    const message =
      // The internal API asks Axios for binary data, so on failure it may still
      // return an ArrayBuffer; decode that into a string so the error dialog can
      // show the server-provided message. When decoding fails or the response
      // already looks like another Axios error we fall back to the Error message
      // or a conservative generic description.
      isAxiosError(error) && error.response?.data
        ? error.response.data instanceof ArrayBuffer
          ? new TextDecoder().decode(new Uint8Array(error.response.data))
          : String(error.response.data)
        : error instanceof Error
          ? error.message
          : "Unable to open Connect content bundle";
    authLogger.error(
      `Unable to fetch bundle ${contentGuid} for ${serverUrl}: ${message}`,
    );
    await window.showErrorMessage(
      `Unable to open Connect content ${contentGuid}: ${message}`,
    );
    // Cache an empty root so VS Code stops retrying the same bundle after a
    // failed fetch; this keeps the file system in a consistent state until the
    // user explicitly retries and clears the cache.
    contentRoots.set(rootKey, createDirectoryEntry());
    return;
  }
}

async function extractBundleTree(bundleBytes: Uint8Array) {
  // Materialize the bundle so the file system can serve reads without touching disk.
  const root = createDirectoryEntry();
  const extract = tar.extract();
  const signature = Array.from(bundleBytes.slice(0, 4))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
  const looksLikeGzip =
    bundleBytes.length >= 2 &&
    bundleBytes[0] === 0x1f &&
    bundleBytes[1] === 0x8b;
  authLogger.info(`Bundle signature: ${signature} (gzip? ${looksLikeGzip})`);
  extract.on(
    "entry",
    (header: tar.Headers, stream: NodeJS.ReadableStream, next: () => void) => {
      authLogger.info(
        `Processing TAR entry ${header.name} (type=${header.type})`,
      );
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
        authLogger.info(`Finished reading file entry ${header.name}`);
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
      stream.on("error", (err) => {
        authLogger.error(
          `Error while reading stream for entry ${header.name}: ${err}`,
        );
        next();
      });
    },
  );
  extract.on("finish", () => {
    authLogger.info(
      `Finished processing all TAR entries (${bundleBytes.length} bytes)`,
    );
  });
  extract.on("error", (err) => {
    authLogger.error(`Error during TAR extraction: ${err}`);
  });
  try {
    authLogger.info(
      `Starting pipeline to extract bundle (${bundleBytes.length} bytes)`,
    );
    const sourceBuffer = Buffer.from(bundleBytes);
    const source = Readable.from([sourceBuffer]);
    authLogger.info(
      `bundle source chunk planned (${sourceBuffer.length} bytes)`,
    );
    source.on("data", (chunk: Buffer) => {
      authLogger.info(`bundle source chunk emitted (${chunk.length} bytes)`);
    });
    source.on("end", () => {
      authLogger.info("bundle source stream ended");
    });
    if (looksLikeGzip) {
      const gunzip = createGunzip();
      gunzip.on("error", (err) => {
        authLogger.error(`gunzip error: ${err}`);
      });
      gunzip.on("data", (chunk: Buffer) => {
        authLogger.info(`gunzip chunk (${chunk.length} bytes)`);
      });
      authLogger.info("Piping bundle through gunzip");
      await pipeline(source, gunzip, extract);
    } else {
      authLogger.info("Skipping gunzip because bundle does not look gzipped");
      await pipeline(source, extract);
    }
    const rootEntries = root.children?.size ?? 0;
    authLogger.info(
      `Extracted bundle tree (${bundleBytes.length} bytes) with ${rootEntries} root entries`,
    );
  } catch (error) {
    authLogger.error(`bundle extraction failed: ${error}`);
    throw error;
  }
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
