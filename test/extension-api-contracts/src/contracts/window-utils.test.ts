// Copyright (C) 2026 by Posit Software, PBC.

// Contract: utils/window.ts → window.showErrorMessage, withProgress, createTerminal

import { describe, it, expect, beforeEach, vi } from "vitest";
import { window, ProgressLocation } from "vscode";
import {
  showErrorMessageWithTroubleshoot,
  showInformationMsg,
  taskWithProgressMsg,
  openTerminalCommand,
  runTerminalCommand,
} from "src/utils/window";

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

    it("does not double-append period when message already ends with one", () => {
      showErrorMessageWithTroubleshoot("Already has period.");
      const msg = vi.mocked(window.showErrorMessage).mock.calls[0][0];
      // Should not start with "Already has period.."
      expect(msg).not.toContain("..");
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

  describe("showInformationMsg", () => {
    it("delegates to window.showInformationMessage", () => {
      showInformationMsg("Hello", "OK");
      expect(window.showInformationMessage).toHaveBeenCalledWith("Hello", "OK");
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
      const mockTerminal = {
        sendText: vi.fn(),
        show: vi.fn(),
        exitStatus: { code: 0 },
        dispose: vi.fn(),
      };
      vi.mocked(window.createTerminal).mockReturnValue(mockTerminal as any);
      openTerminalCommand("echo hello");
      expect(window.createTerminal).toHaveBeenCalledTimes(1);
      expect(mockTerminal.sendText).toHaveBeenCalledWith("echo hello;");
      expect(mockTerminal.show).toHaveBeenCalledTimes(1);
    });
  });

  describe("runTerminalCommand", () => {
    it("creates a terminal and sends command with exit", () => {
      const mockTerminal = {
        sendText: vi.fn(),
        show: vi.fn(),
        exitStatus: { code: 0 },
        dispose: vi.fn(),
      };
      vi.mocked(window.createTerminal).mockReturnValue(mockTerminal as any);

      // Start the command (don't await yet)
      runTerminalCommand("npm test");

      expect(window.createTerminal).toHaveBeenCalledTimes(1);
      expect(mockTerminal.sendText).toHaveBeenCalledWith("npm test; exit $?");
    });

    it("listens to window.onDidCloseTerminal for terminal exit", () => {
      const mockTerminal = {
        sendText: vi.fn(),
        show: vi.fn(),
        exitStatus: { code: 0 },
        dispose: vi.fn(),
      };
      vi.mocked(window.createTerminal).mockReturnValue(mockTerminal as any);

      runTerminalCommand("test");
      expect(window.onDidCloseTerminal).toHaveBeenCalledTimes(1);
    });
  });
});
