// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ExtensionContext } from "vscode";

// Mock child_process
const mockProcess = {
  kill: vi.fn(),
  stderr: new EventEmitter(),
  on: vi.fn(),
};

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockProcess),
}));

// Mock vscode
const mockStatusBarMessage = {
  dispose: vi.fn(),
};

vi.mock("vscode", () => ({
  window: {
    setStatusBarMessage: vi.fn(() => mockStatusBarMessage),
  },
}));

// Mock src modules
vi.mock("src/commands", () => ({
  create: vi.fn(() => Promise.resolve(["/path/to/binary", ["arg1", "arg2"]])),
}));

vi.mock("src/workspaces", () => ({
  path: vi.fn(() => "/workspace/path"),
}));

vi.mock("src/logging", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logAgentOutput: vi.fn(),
}));

import { Server } from "./servers";
import { spawn } from "node:child_process";
import { window } from "vscode";
import { logger } from "src/logging";

// Type helper for accessing private properties in tests
// Using a separate interface avoids intersection issues with private properties
interface ServerInternal {
  stopping: boolean;
}

describe("Server", () => {
  let server: Server;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new Server(9000, true);

    // Reset mock process handlers
    mockProcess.on.mockReset();
    mockProcess.kill.mockReset();

    // Reset status bar mock
    vi.mocked(window.setStatusBarMessage).mockReturnValue(mockStatusBarMessage);
  });

  describe("constructor", () => {
    test("initializes with port and useKeyChain", () => {
      const s = new Server(8080, false);
      expect(s.port).toBe(8080);
      expect(s.useKeyChain).toBe(false);
    });

    test("process is initially undefined", () => {
      expect(server.process).toBeUndefined();
    });

    test("stopping flag is initially false", () => {
      expect((server as unknown as ServerInternal).stopping).toBe(false);
    });
  });

  describe("stop", () => {
    test("does nothing if server is already down", async () => {
      // Mock isDown to return true (server is down)
      vi.spyOn(server, "isDown").mockResolvedValue(true);

      await server.stop();

      expect(mockProcess.kill).not.toHaveBeenCalled();
      expect(window.setStatusBarMessage).not.toHaveBeenCalled();
    });

    test("sets stopping flag to true", async () => {
      server.process = mockProcess as unknown as ChildProcessWithoutNullStreams;

      // First isDown call: server is up (false), second: server is down (true)
      vi.spyOn(server, "isDown")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await server.stop();

      expect((server as unknown as ServerInternal).stopping).toBe(true);
    });

    test("kills process with SIGINT", async () => {
      server.process = mockProcess as unknown as ChildProcessWithoutNullStreams;

      vi.spyOn(server, "isDown")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await server.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGINT");
    });

    test("shows and disposes status bar message", async () => {
      server.process = mockProcess as unknown as ChildProcessWithoutNullStreams;

      vi.spyOn(server, "isDown")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await server.stop();

      expect(window.setStatusBarMessage).toHaveBeenCalledWith(
        "Stopping Posit Publisher. Please wait...",
      );
      expect(mockStatusBarMessage.dispose).toHaveBeenCalled();
    });

    test("handles VS Code shutdown gracefully when setStatusBarMessage throws", async () => {
      server.process = mockProcess as unknown as ChildProcessWithoutNullStreams;

      vi.mocked(window.setStatusBarMessage).mockImplementation(() => {
        throw new Error("VS Code is shutting down");
      });

      vi.spyOn(server, "isDown")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      // Should not throw
      await expect(server.stop()).resolves.toBeUndefined();
      expect(mockProcess.kill).toHaveBeenCalledWith("SIGINT");
    });
  });

  describe("dispose", () => {
    test("sets stopping flag to true", () => {
      server.process = mockProcess as unknown as ChildProcessWithoutNullStreams;

      server.dispose();

      expect((server as unknown as ServerInternal).stopping).toBe(true);
    });

    test("kills process with SIGINT", () => {
      server.process = mockProcess as unknown as ChildProcessWithoutNullStreams;

      server.dispose();

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGINT");
    });

    test("handles undefined process gracefully", () => {
      server.process = undefined;

      expect(() => server.dispose()).not.toThrow();
    });
  });

  describe("start", () => {
    test("resets stopping flag to false", async () => {
      (server as unknown as ServerInternal).stopping = true;

      // Server is already up, so start returns early
      vi.spyOn(server, "isDown").mockResolvedValue(false);

      const mockContext = {} as ExtensionContext;
      await server.start(mockContext);

      expect((server as unknown as ServerInternal).stopping).toBe(false);
    });

    test("does nothing if server is already running", async () => {
      vi.spyOn(server, "isDown").mockResolvedValue(false);

      const mockContext = {} as ExtensionContext;
      await server.start(mockContext);

      expect(spawn).not.toHaveBeenCalled();
    });

    test("spawns process when server is down", async () => {
      vi.spyOn(server, "isDown").mockResolvedValue(true);
      vi.spyOn(server, "isUp").mockResolvedValue(true);

      const mockContext = {} as ExtensionContext;
      await server.start(mockContext);

      expect(spawn).toHaveBeenCalled();
    });
  });

  describe("auto-restart behavior", () => {
    test("close handler does not restart when stopping flag is true", async () => {
      // Capture the close handler
      let closeHandler: ((code: number) => void) | undefined;
      mockProcess.on.mockImplementation((event: string, handler: unknown) => {
        if (event === "close") {
          closeHandler = handler as (code: number) => void;
        }
        return mockProcess;
      });

      vi.spyOn(server, "isDown").mockResolvedValue(true);
      vi.spyOn(server, "isUp").mockResolvedValue(true);

      const mockContext = {} as ExtensionContext;
      await server.start(mockContext);

      expect(closeHandler).toBeDefined();

      // Clear spawn mock to track new calls
      vi.mocked(spawn).mockClear();

      // Set stopping flag (simulating intentional stop)
      (server as unknown as ServerInternal).stopping = true;

      // Trigger close event
      closeHandler!(0);

      // Should NOT restart
      expect(spawn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "Agent process exited with code 0",
      );
    });

    test("close handler restarts when stopping flag is false", async () => {
      let closeHandler: ((code: number) => void) | undefined;
      mockProcess.on.mockImplementation((event: string, handler: unknown) => {
        if (event === "close") {
          closeHandler = handler as (code: number) => void;
        }
        return mockProcess;
      });

      vi.spyOn(server, "isDown").mockResolvedValue(true);
      vi.spyOn(server, "isUp").mockResolvedValue(true);

      const mockContext = {} as ExtensionContext;
      await server.start(mockContext);

      expect(closeHandler).toBeDefined();

      vi.mocked(spawn).mockClear();

      // stopping flag is false (unexpected crash)
      expect((server as unknown as ServerInternal).stopping).toBe(false);

      // Trigger close event
      closeHandler!(1);

      // Should restart
      expect(spawn).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "Agent process exited with code 1; restarting...",
      );
    });
  });
});
