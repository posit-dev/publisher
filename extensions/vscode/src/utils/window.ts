// Copyright (C) 2025 by Posit Software, PBC.

import { window } from "vscode";

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
