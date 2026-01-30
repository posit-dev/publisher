// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { gzipSync } from "node:zlib";
import tar from "tar-stream";

const mockOpenConnectContent = vi.fn();
vi.mock("src/api", () => ({
  useApi: () =>
    Promise.resolve({
      openConnectContent: { openConnectContent: mockOpenConnectContent },
    }),
}));

vi.mock("src/logging", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("vscode", () => ({
  EventEmitter: class {
    event = vi.fn();
  },
  Disposable: class {
    constructor(fn?: () => void) {
      this.dispose = fn ?? (() => {});
    }
    dispose: () => void;
  },
  FileSystemError: {
    FileNotFound: () =>
      Object.assign(new Error("FileNotFound"), { code: "FileNotFound" }),
    FileIsADirectory: () =>
      Object.assign(new Error("FileIsADirectory"), {
        code: "FileIsADirectory",
      }),
    FileNotADirectory: () =>
      Object.assign(new Error("FileNotADirectory"), {
        code: "FileNotADirectory",
      }),
    NoPermissions: (msg: string) =>
      Object.assign(new Error(msg), { code: "NoPermissions" }),
  },
  FileType: { File: 1, Directory: 2 },
  Uri: {
    from: (c: { scheme: string; authority: string; path: string }) => ({
      ...c,
      toString: () => `${c.scheme}://${c.authority}${c.path}`,
    }),
  },
  commands: { executeCommand: vi.fn() },
  window: { showErrorMessage: vi.fn() },
  workspace: {},
}));

import {
  ConnectContentFileSystemProvider,
  clearConnectContentBundle,
} from "./connect_content_fs";
import { PublisherState } from "./state";

const FILE = 1;
const DIRECTORY = 2;

async function createFakeTgzBundle(
  entries: Array<{
    name: string;
    type: "file" | "directory";
    content?: string;
  }>,
): Promise<Uint8Array> {
  const pack = tar.pack();
  for (const entry of entries) {
    if (entry.type === "directory") {
      pack.entry({ name: entry.name, type: "directory" });
    } else {
      pack.entry(
        {
          name: entry.name,
          type: "file",
          size: Buffer.byteLength(entry.content ?? ""),
        },
        entry.content ?? "",
      );
    }
  }
  pack.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of pack) chunks.push(chunk);
  return new Uint8Array(gzipSync(Buffer.concat(chunks)));
}

function makeUri(authority: string, path: string) {
  return {
    scheme: "connect-content",
    authority,
    path,
    query: "",
    fragment: "",
    fsPath: path,
    toString: () => `connect-content://${authority}${path}`,
    toJSON: () => ({ scheme: "connect-content", authority, path }),
    with: (change: { path?: string }) =>
      makeUri(authority, change.path ?? path),
  };
}

describe("ConnectContentFileSystemProvider", () => {
  let provider: ConnectContentFileSystemProvider;

  const testServerUrl = "https://connect.example.com";
  const testContentGuid = "abc123-def456";
  const testAuthority = "https@connect.example.com";

  beforeEach(() => {
    clearConnectContentBundle(testServerUrl, testContentGuid);
    vi.clearAllMocks();
    const mockState = {
      refreshCredentials: vi.fn().mockResolvedValue(undefined),
      credentials: [{ url: testServerUrl, name: "test" }],
    } as unknown as PublisherState;
    provider = new ConnectContentFileSystemProvider(Promise.resolve(mockState));
  });

  describe("stat", () => {
    test("returns directory stat for root of bundle", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "file.txt", type: "file", content: "hello" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const stat = await provider.stat(
        makeUri(testAuthority, `/${testContentGuid}`),
      );

      expect(stat.type).toBe(DIRECTORY);
    });

    test("returns file stat for file in bundle", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "manifest.json", type: "file", content: '{"version": 1}' },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const stat = await provider.stat(
        makeUri(testAuthority, `/${testContentGuid}/manifest.json`),
      );

      expect(stat.type).toBe(FILE);
      expect(stat.size).toBe(14);
    });

    test("returns directory stat for subdirectory", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "assets/", type: "directory" },
        { name: "assets/style.css", type: "file", content: "body {}" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const stat = await provider.stat(
        makeUri(testAuthority, `/${testContentGuid}/assets`),
      );

      expect(stat.type).toBe(DIRECTORY);
    });

    test("throws FileNotFound for non-existent path", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "exists.txt", type: "file", content: "hello" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      await expect(
        provider.stat(
          makeUri(testAuthority, `/${testContentGuid}/does-not-exist.txt`),
        ),
      ).rejects.toThrow();
    });
  });

  describe("readDirectory", () => {
    test("lists files and directories at root", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "manifest.json", type: "file", content: "{}" },
        { name: "index.html", type: "file", content: "<html>" },
        { name: "assets/", type: "directory" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const entries = await provider.readDirectory(
        makeUri(testAuthority, `/${testContentGuid}`),
      );

      expect(entries).toHaveLength(3);
      expect(entries).toContainEqual(["manifest.json", FILE]);
      expect(entries).toContainEqual(["index.html", FILE]);
      expect(entries).toContainEqual(["assets", DIRECTORY]);
    });

    test("lists files in subdirectory", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "assets/style.css", type: "file", content: "body {}" },
        { name: "assets/script.js", type: "file", content: "console.log()" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const entries = await provider.readDirectory(
        makeUri(testAuthority, `/${testContentGuid}/assets`),
      );

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(["style.css", FILE]);
      expect(entries).toContainEqual(["script.js", FILE]);
    });

    test("returns empty array for empty directory", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "empty/", type: "directory" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const entries = await provider.readDirectory(
        makeUri(testAuthority, `/${testContentGuid}/empty`),
      );

      expect(entries).toHaveLength(0);
    });
  });

  describe("readFile", () => {
    test("reads file content from bundle", async () => {
      const content = '{"version": 1, "name": "test"}';
      const bundle = await createFakeTgzBundle([
        { name: "manifest.json", type: "file", content },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const data = await provider.readFile(
        makeUri(testAuthority, `/${testContentGuid}/manifest.json`),
      );

      expect(new TextDecoder().decode(data)).toBe(content);
    });

    test("reads file in nested directory", async () => {
      const content = "deep file content";
      const bundle = await createFakeTgzBundle([
        { name: "a/b/c/file.txt", type: "file", content },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const data = await provider.readFile(
        makeUri(testAuthority, `/${testContentGuid}/a/b/c/file.txt`),
      );

      expect(new TextDecoder().decode(data)).toBe(content);
    });

    test("throws FileIsADirectory when reading directory", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "folder/", type: "directory" },
        { name: "folder/file.txt", type: "file", content: "x" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      await expect(
        provider.readFile(makeUri(testAuthority, `/${testContentGuid}/folder`)),
      ).rejects.toThrow();
    });

    test("returns empty content for empty file", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "empty.txt", type: "file", content: "" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      const data = await provider.readFile(
        makeUri(testAuthority, `/${testContentGuid}/empty.txt`),
      );

      expect(data.length).toBe(0);
    });
  });

  describe("read-only enforcement", () => {
    test("createDirectory throws NoPermissions", () => {
      expect(() => provider.createDirectory()).toThrow();
    });

    test("writeFile throws NoPermissions", () => {
      expect(() => provider.writeFile()).toThrow();
    });

    test("delete throws NoPermissions", () => {
      expect(() => provider.delete()).toThrow();
    });

    test("rename throws NoPermissions", () => {
      expect(() => provider.rename()).toThrow();
    });
  });

  describe("caching", () => {
    test("does not refetch bundle on subsequent calls", async () => {
      const bundle = await createFakeTgzBundle([
        { name: "file.txt", type: "file", content: "hello" },
      ]);
      mockOpenConnectContent.mockResolvedValue({ data: bundle.buffer });

      await provider.stat(makeUri(testAuthority, `/${testContentGuid}`));
      expect(mockOpenConnectContent).toHaveBeenCalledTimes(1);

      await provider.stat(makeUri(testAuthority, `/${testContentGuid}`));
      await provider.readDirectory(
        makeUri(testAuthority, `/${testContentGuid}`),
      );
      expect(mockOpenConnectContent).toHaveBeenCalledTimes(1);
    });
  });
});
