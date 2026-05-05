// Copyright (C) 2026 by Posit Software, PBC.

// Contract: utils/window.ts → window.showErrorMessage, withProgress, createTerminal

import { describe, it, expect, beforeEach, vi } from "vitest";
import { window, ProgressLocation } from "vscode";
import {
  showErrorMessageWithTroubleshoot,
  taskWithProgressMsg,
  openTerminalCommand,
  runTerminalCommand,
} from "src/utils/window";

function createMockTerminal() {
  const terminal = {
    sendText: vi.fn(),
    show: vi.fn(),
    exitStatus: { code: 0 },
    dispose: vi.fn(),
  };
  vi.mocked(window.createTerminal).mockReturnValue(terminal as any);
  return terminal;
}

describe("window-utils contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("showErrorMessageWithTroubleshoot", () => {
    it("calls window.showErrorMessage with troubleshooting link appended", () => {
      showErrorMessageWithTroubleshoot("Something failed");
      expect(window.showErrorMessage).toHaveBeenCalledTimes(1);
      const msg = vi.mocked(window.showErrorMessage).mock.calls[0][0];
      expect(msg).toContain("Something failed.");
      expect(msg).toContain("Troubleshooting docs");
      expect(msg).toContain(
        "github.com/posit-dev/publisher/blob/main/docs/troubleshooting.md",
      );
    });

    it("forwards extra items to showErrorMessage", () => {
      showErrorMessageWithTroubleshoot("Fail", "Retry", "Cancel");
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        expect.any(String),
        "Retry",
        "Cancel",
      );
    });
  });

  describe("taskWithProgressMsg", () => {
    it("calls window.withProgress with Notification location", async () => {
      const task = vi.fn(() => Promise.resolve());
      await taskWithProgressMsg("Loading...", task);
      expect(window.withProgress).toHaveBeenCalledTimes(1);
      const options = vi.mocked(window.withProgress).mock.calls[0][0];
      expect(options).toEqual({
        location: ProgressLocation.Notification,
        title: "Loading...",
        cancellable: false,
      });
    });

    it("sets cancellable to true when onCancel is provided", async () => {
      const task = vi.fn(() => Promise.resolve());
      const onCancel = vi.fn();
      await taskWithProgressMsg("Loading...", task, onCancel);
      const options = vi.mocked(window.withProgress).mock.calls[0][0];
      expect(options.cancellable).toBe(true);
    });

    it("invokes the task with progress and cancellation token", async () => {
      const task = vi.fn(() => Promise.resolve());
      await taskWithProgressMsg("Work", task);
      // The mock withProgress immediately invokes the task callback
      expect(task).toHaveBeenCalledTimes(1);
      const [progress, token] = task.mock.calls[0];
      expect(progress).toHaveProperty("report");
      expect(token).toHaveProperty("isCancellationRequested");
      expect(token).toHaveProperty("onCancellationRequested");
    });
  });

  describe("openTerminalCommand", () => {
    it("creates a terminal, sends command, and shows it", () => {
      const terminal = createMockTerminal();
      openTerminalCommand("echo hello");
      expect(window.createTerminal).toHaveBeenCalledTimes(1);
      expect(terminal.sendText).toHaveBeenCalledWith("echo hello;");
      expect(terminal.show).toHaveBeenCalledTimes(1);
    });
  });

  describe("runTerminalCommand", () => {
    it("creates a terminal and sends command with exit", () => {
      const terminal = createMockTerminal();
      runTerminalCommand("npm test");
      expect(window.createTerminal).toHaveBeenCalledTimes(1);
      expect(terminal.sendText).toHaveBeenCalledWith("npm test; exit $?");
    });

    it("listens to window.onDidCloseTerminal for terminal exit", () => {
      createMockTerminal();
      runTerminalCommand("test");
      expect(window.onDidCloseTerminal).toHaveBeenCalledTimes(1);
    });
  });
});
