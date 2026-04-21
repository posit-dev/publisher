// Copyright (C) 2024 by Posit Software, PBC.

import { Position, Range, Uri, window } from "vscode";

import { EditConfigurationSelection } from "./types/messages/webviewToHostMessages";

export { copySystemInfoCommand } from "./commands/copySystemInfo";

const args = ["@ext:posit.publisher"];
export const openConfigurationCommand = Uri.parse(
  `command:workbench.action.openSettings?${encodeURIComponent(JSON.stringify(args))}`,
);

export const openFileInEditor = async (
  path: string,
  options?: { selection?: EditConfigurationSelection },
) => {
  let start = new Position(0, 0);
  let end = new Position(0, 0);

  if (options && options.selection) {
    start = new Position(
      options.selection.start.line,
      options.selection.start.character,
    );
    if (options.selection.end) {
      end = new Position(
        options.selection.end.line,
        options.selection.end.character,
      );
    } else {
      end = start;
    }
  }

  // we'll only indicate a location, if one was passed to us.
  await window.showTextDocument(Uri.file(path), {
    selection: options && options.selection ? new Range(start, end) : undefined,
  });
};
