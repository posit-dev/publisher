// Copyright (C) 2025 by Posit Software, PBC.

import { window, ProgressLocation, Progress, CancellationToken } from "vscode";

export function showErrorMessageWithTroubleshoot(
  message: string,
  ...items: string[]
) {
  let msg = message;
  if (!message.endsWith(".")) {
    msg += ".";
  }
  msg +=
    " See [Troubleshooting docs](https://github.com/posit-dev/publisher/blob/main/docs/troubleshooting.md) for help.";
  return window.showErrorMessage(msg, ...items);
}

export function showInformationMsg(msg: string, ...items: string[]) {
  return window.showInformationMessage(msg, ...items);
}

type taskFunc = <T>(p: Progress<T>, t: CancellationToken) => Promise<void>;
const progressCallbackHandlerFactory =
  (task: taskFunc, onCancel?: () => void): taskFunc =>
  (progress, token) => {
    if (onCancel) {
      token.onCancellationRequested(() => {
        onCancel();
      });
    }
    return task(progress, token);
  };

export function taskWithProgressMsg(
  msg: string,
  task: taskFunc,
  onCancel?: () => void,
) {
  return window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: msg,
      cancellable: onCancel !== undefined,
    },
    progressCallbackHandlerFactory(task, onCancel),
  );
}

// Run command and open the terminal
export function openTerminalCommand(cmd: string) {
  const term = window.createTerminal();
  term.sendText(`${cmd};`);
  term.show();
}

// Runs the command on the terminal, terminal process is closed automatically after the command finishes.
// Promise resolves for successful exit code 0
// Promise rejects for exit code > 0
export function runTerminalCommand(cmd: string): Promise<number | undefined> {
  const term = window.createTerminal();
  term.sendText(`${cmd}; exit $?`);

  return new Promise((resolve, reject) => {
    const disposeToken = window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === term) {
        disposeToken.dispose();
        if (term.exitStatus && term.exitStatus.code === 0) {
          resolve(term.exitStatus.code);
        } else {
          reject(term.exitStatus?.code);
        }
      }
    });
  });
}
