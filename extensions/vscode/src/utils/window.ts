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

export function runTerminalCommand(
  cmd: string,
  show: boolean = false,
): Promise<void> {
  const term = window.createTerminal();
  term.sendText(cmd);

  // If terminal is shown, there is no need to track exit status for it
  // everything will be visible on it.
  if (show) {
    term.show();
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const disposeToken = window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === term) {
        disposeToken.dispose();
        if (term.exitStatus && term.exitStatus.code === 0) {
          resolve();
        } else {
          reject();
        }
      }
    });
  });
}
