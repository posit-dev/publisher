// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, beforeEach, test, vi } from "vitest";
import { window } from "vscode";
import {
  showErrorMessageWithTroubleshoot,
  showInformationMsg,
  taskWithProgressMsg,
  runTerminalCommand,
} from "./window";

const terminalMock = {
  sendText: vi.fn(),
  show: vi.fn(),
  exitStatus: {
    code: 0,
  },
};

vi.mock("vscode", () => {
  // mock Disposable
  const disposableMock = vi.fn();
  disposableMock.prototype.dispose = vi.fn();

  // mock window
  const windowMock = {
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    withProgress: vi.fn().mockImplementation((_, progressCallback) => {
      progressCallback();
    }),
    createTerminal: vi.fn().mockImplementation(() => {
      terminalMock.sendText = vi.fn();
      terminalMock.show = vi.fn();
      return terminalMock;
    }),
    onDidCloseTerminal: vi.fn().mockImplementation((fn) => {
      setTimeout(() => fn(terminalMock), 100);
      return new disposableMock();
    }),
  };

  return {
    Disposable: disposableMock,
    window: windowMock,
    ProgressLocation: {
      SourceControl: 1,
      Window: 10,
      Notification: 15,
    },
  };
});

describe("Consumers of vscode window", () => {
  beforeEach(() => {
    terminalMock.exitStatus.code = 0;
  });

  test("showErrorMessageWithTroubleshoot", () => {
    showErrorMessageWithTroubleshoot("Bad things happened");
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      "Bad things happened. See [Troubleshooting docs](https://github.com/posit-dev/publisher/blob/main/docs/troubleshooting.md) for help.",
    );

    showErrorMessageWithTroubleshoot(
      "Bad things happened.",
      "one",
      "two",
      "three",
    );
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      "Bad things happened. See [Troubleshooting docs](https://github.com/posit-dev/publisher/blob/main/docs/troubleshooting.md) for help.",
      "one",
      "two",
      "three",
    );
  });

  test("showInformationMsg", () => {
    showInformationMsg("Good thing happened");
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      "Good thing happened",
    );

    showInformationMsg("Good thing happened", "one", "two", "three");
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      "Good thing happened",
      "one",
      "two",
      "three",
    );
  });

  test("taskWithProgressMsg", () => {
    const taskMock = vi.fn();
    taskWithProgressMsg(
      "Running a task with a progress notification",
      taskMock,
    );
    expect(window.withProgress).toHaveBeenCalledWith(
      {
        location: 15,
        title: "Running a task with a progress notification",
        cancellable: false,
      },
      expect.any(Function),
    );
    expect(taskMock).toHaveBeenCalled();
  });

  describe("runTerminalCommand", () => {
    test("showing the terminal", async () => {
      await runTerminalCommand("stat somefile.txt", true);
      expect(terminalMock.sendText).toHaveBeenCalledWith("stat somefile.txt");
      expect(terminalMock.show).toHaveBeenCalled();
      // For terminals that we open, we don't track close events
      expect(window.onDidCloseTerminal).not.toHaveBeenCalled();
    });

    test("NOT showing the terminal", async () => {
      await runTerminalCommand("stat somefile.txt");
      expect(terminalMock.sendText).toHaveBeenCalledWith("stat somefile.txt");
      // For terminals that we DO NOT open, we DO track close events
      expect(terminalMock.show).not.toHaveBeenCalled();
      expect(window.onDidCloseTerminal).toHaveBeenCalled();
    });

    test("catch non zero exit status", async () => {
      terminalMock.exitStatus.code = 1;
      try {
        await runTerminalCommand("stat somefile.txt");
      } catch (_) {
        expect(terminalMock.sendText).toHaveBeenCalledWith("stat somefile.txt");
        // For terminals that we DO NOT open, we DO track close events
        expect(terminalMock.show).not.toHaveBeenCalled();
        expect(window.onDidCloseTerminal).toHaveBeenCalled();
      }
    });
  });
});
