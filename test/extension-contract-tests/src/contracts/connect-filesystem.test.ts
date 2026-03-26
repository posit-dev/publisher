// Copyright (C) 2026 by Posit Software, PBC.

// Contract: connect_content_fs.ts → workspace.registerFileSystemProvider, FileSystemError, FileType

import { describe, it, expect, beforeEach, vi } from "vitest";
import { workspace, FileSystemError, FileType, Uri } from "vscode";

// Mock internal dependencies
vi.mock("src/api", () => ({
  useApi: vi.fn(() =>
    Promise.resolve({
      openConnectContent: {
        openConnectContent: vi.fn(() =>
          Promise.resolve({ data: new ArrayBuffer(0) }),
        ),
      },
    }),
  ),
}));

vi.mock("src/logging", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("src/constants", () => ({
  Commands: {
    HomeView: {
      AddCredential: "posit.publisher.homeView.addCredential",
    },
  },
}));

// Mock third-party dependencies that connect_content_fs.ts imports
vi.mock("tar-stream", () => ({
  default: { extract: vi.fn(() => ({ on: vi.fn() })) },
  extract: vi.fn(() => ({ on: vi.fn() })),
}));

vi.mock("axios", () => ({
  default: { isAxiosError: vi.fn(() => false) },
  isAxiosError: vi.fn(() => false),
}));

vi.mock("@posit-dev/connect-api", () => ({
  ConnectAPI: vi.fn(),
  ContentID: vi.fn((id: string) => id),
  BundleID: vi.fn((id: string) => id),
}));

const {
  registerConnectContentFileSystem,
  ConnectContentFileSystemProvider,
  connectContentUri,
} = await import("src/connect_content_fs");

describe("connect-filesystem contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerConnectContentFileSystem", () => {
    it("calls workspace.registerFileSystemProvider with connect-content scheme", () => {
      const mockStatePromise = Promise.resolve({} as any);
      registerConnectContentFileSystem(mockStatePromise);

      expect(workspace.registerFileSystemProvider).toHaveBeenCalledWith(
        "connect-content",
        expect.any(Object),
        { isReadonly: true },
      );
    });
  });

  describe("ConnectContentFileSystemProvider", () => {
    it("exposes onDidChangeFile event", () => {
      const provider = new ConnectContentFileSystemProvider(
        Promise.resolve({} as any),
      );
      expect(provider.onDidChangeFile).toBeDefined();
    });

    it("watch() returns a Disposable", () => {
      const provider = new ConnectContentFileSystemProvider(
        Promise.resolve({} as any),
      );
      const disposable = provider.watch(Uri.file("/test") as any, {} as any);
      expect(disposable).toHaveProperty("dispose");
    });

    it.each(["createDirectory", "writeFile", "delete", "rename"])(
      "%s throws FileSystemError.NoPermissions",
      (method) => {
        const provider = new ConnectContentFileSystemProvider(
          Promise.resolve({} as any),
        );
        expect(() => (provider as any)[method]()).toThrow();
        expect(FileSystemError.NoPermissions).toHaveBeenCalledWith(
          "connect-content is read-only",
        );
      },
    );
  });

  describe("connectContentUri", () => {
    it("creates a URI with connect-content scheme", () => {
      const uri = connectContentUri("https://connect.example.com", "test-guid");
      expect(Uri.from).toHaveBeenCalledWith({
        scheme: "connect-content",
        authority: expect.any(String),
        path: "/test-guid",
      });
    });
  });
});
