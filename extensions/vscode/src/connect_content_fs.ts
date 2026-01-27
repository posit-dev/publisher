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
  commands,
  window,
  workspace,
} from "vscode";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import tar from "tar-stream";
import { useApi } from "./api";
import { logger } from "./logging";
import { isAxiosError } from "axios";
import { Commands } from "src/constants";
import { PublisherState } from "./state";

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
const bundleFetches = new Map<string, Promise<void>>();

export function normalizeServerUrl(value: string): string {
  if (!value) {
    return "";
  }
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

// Track which bundle contents back a Connect content URI.
// Drop any cached bundle so reopening always fetches fresh content.
export function clearConnectContentBundle(
  serverUrl: string,
  contentGuid: string,
) {
  logger.info(`Clearing cached bundle ${contentGuid} for ${serverUrl}`);
  contentRoots.delete(connectContentUri(serverUrl, contentGuid).toString());
  bundleFetches.delete(connectContentUri(serverUrl, contentGuid).toString());
}

// Clear cached bundles when a connect-content workspace folder is removed.
export function clearConnectContentBundleForUri(uri: Uri) {
  if (uri.scheme !== CONNECT_CONTENT_SCHEME) {
    return;
  }
  logger.info(`Clearing bundle cache for removed workspace ${uri.toString()}`);
  contentRoots.delete(uri.toString());
  bundleFetches.delete(uri.toString());
}

// Construct the Connect content URI that the extension opens in VS Code.
// The server URL is encoded in the authority using the format: protocol@host:port
export function connectContentUri(serverUrl: string, contentGuid: string) {
  return Uri.from({
    scheme: CONNECT_CONTENT_SCHEME,
    authority: encodeServerUrlAsAuthority(serverUrl),
    path: `/${contentGuid}`,
  });
}

// Register a read-only file system so VS Code can browse Connect content.
export function registerConnectContentFileSystem(
  publisherStateReadyPromise: Promise<PublisherState>,
): Disposable {
  logger.info("Registering connect-content file system provider");
  const provider = new ConnectContentFileSystemProvider(
    publisherStateReadyPromise,
  );
  return workspace.registerFileSystemProvider(
    CONNECT_CONTENT_SCHEME,
    provider,
    { isReadonly: true },
  );
}

export class ConnectContentFileSystemProvider implements FileSystemProvider {
  private fileChangeEmitter = new EventEmitter<FileChangeEvent[]>();
  onDidChangeFile = this.fileChangeEmitter.event;

  watch(): Disposable {
    return new Disposable(() => undefined);
  }

  private readonly publisherStateReady: Promise<PublisherState>;

  constructor(publisherStateReadyPromise: Promise<PublisherState>) {
    this.publisherStateReady = publisherStateReadyPromise;
  }

  async stat(uri: Uri): Promise<FileStat> {
    logger.info(`connect-content stat ${uri.toString()}`);
    const entry = await this.resolveEntry(uri);
    return statFromEntry(entry);
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    logger.info(`connect-content readDirectory ${uri.toString()}`);
    const entry = await this.resolveEntry(uri);
    return listDirectory(entry);
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    logger.info(`connect-content readFile ${uri.toString()}`);
    const entry = await this.resolveEntry(uri);
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

  private async ensureCredentialsForServer(serverUrl: string) {
    const state = await this.publisherStateReady;
    const normalizedServer = normalizeServerUrl(serverUrl);
    if (!normalizedServer) {
      throw new Error(`Invalid server URL ${serverUrl}`);
    }
    await state.refreshCredentials();
    if (hasCredentialForServer(normalizedServer, state)) {
      return normalizedServer;
    }
    logger.warn(
      `No credentials for ${normalizedServer}. Opening credential flow.`,
    );
    await commands.executeCommand(
      Commands.HomeView.AddCredential,
      normalizedServer,
    );
    await state.refreshCredentials();
    if (hasCredentialForServer(normalizedServer, state)) {
      return normalizedServer;
    }
    throw new Error(`No valid credentials available for ${normalizedServer}`);
  }

  private async ensureBundleForUri(uri: Uri): Promise<void> {
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
      pending = this.fetchAndCacheBundle(
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

  private async fetchAndCacheBundle(
    serverUrl: string,
    contentGuid: string,
    rootKey: string,
  ) {
    let normalizedServerUrl = serverUrl;
    try {
      normalizedServerUrl = await this.ensureCredentialsForServer(serverUrl);
      const api = await useApi();
      const response = await api.openConnectContent.openConnectContent(
        normalizedServerUrl,
        contentGuid,
      );
      const bundleBytes = new Uint8Array(response.data);
      const root = await extractBundleTree(bundleBytes);
      contentRoots.set(rootKey, root);
      logger.info(
        `Fetched bundle ${contentGuid} for ${normalizedServerUrl} and cached for ${rootKey}`,
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
      logger.error(
        `Unable to fetch bundle ${contentGuid} for ${normalizedServerUrl}: ${message}`,
      );
      await window.showErrorMessage(
        `Unable to open Connect content ${contentGuid}: ${message}`,
      );
      contentRoots.set(rootKey, createDirectoryEntry());
      return;
    }
  }

  private async resolveEntry(uri: Uri): Promise<ConnectContentEntry> {
    await this.ensureBundleForUri(uri);
    const trimmedPath = uri.path.replace(/^\/+/, "");
    const [contentGuid, ...rest] = trimmedPath.split("/");
    if (!contentGuid) {
      throw FileSystemError.FileNotFound(uri);
    }
    const root = contentRoots.get(
      uri.with({ path: `/${contentGuid}` }).toString(),
    );
    if (!root) {
      logger.error(`No cached bundle for ${uri.toString()}`);
      throw FileSystemError.FileNotFound(uri);
    }
    logger.info(
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

// Encode a server URL into a URI authority component using the format: protocol@host:port
function encodeServerUrlAsAuthority(serverUrl: string): string {
  try {
    const parsed = new URL(serverUrl);
    // Encode as protocol@host (port is included in host if non-default)
    return `${parsed.protocol.replace(":", "")}@${parsed.host}`;
  } catch {
    return "";
  }
}

// Decode a URI authority component back into a server URL
function decodeAuthorityAsServerUrl(authority: string): string | null {
  if (!authority) {
    return null;
  }
  if (authority.startsWith("https@")) {
    return authority.replace("https@", "https://");
  }
  if (authority.startsWith("http@")) {
    return authority.replace("http@", "http://");
  }
  return `https://${authority}`;
}

function parseConnectContentUri(uri: Uri) {
  if (uri.scheme !== CONNECT_CONTENT_SCHEME) {
    return null;
  }
  const serverUrl = decodeAuthorityAsServerUrl(uri.authority);
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

function hasCredentialForServer(server: string, state: PublisherState) {
  return state.credentials.some(
    (credential) =>
      normalizeServerUrl(credential.url) === server ||
      credential.url === server,
  );
}

function isValidOrigin(serverUrl: string) {
  try {
    new URL(serverUrl);
    return true;
  } catch {
    return false;
  }
}

async function extractBundleTree(bundleBytes: Uint8Array) {
  const root = createDirectoryEntry();
  const extract = tar.extract();
  const looksLikeGzip =
    bundleBytes.length >= 2 &&
    bundleBytes[0] === 0x1f &&
    bundleBytes[1] === 0x8b;
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
      stream.on("error", (err) => {
        logger.error(`Error reading tar entry ${header.name}: ${err}`);
        next();
      });
    },
  );
  extract.on("error", (err) => {
    logger.error(`Tar extraction error: ${err}`);
  });
  try {
    const source = Readable.from([Buffer.from(bundleBytes)]);
    if (looksLikeGzip) {
      const gunzip = createGunzip();
      gunzip.on("error", (err) => {
        logger.error(`Gunzip error: ${err}`);
      });
      await pipeline(source, gunzip, extract);
    } else {
      await pipeline(source, extract);
    }
    logger.info(
      `Extracted bundle (${bundleBytes.length} bytes, ${root.children?.size ?? 0} root entries)`,
    );
  } catch (error) {
    logger.error(`Bundle extraction failed: ${error}`);
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
