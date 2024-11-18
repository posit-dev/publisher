// Copyright (C) 2024 by Posit Software, PBC.

import * as path from "path";

import { ExtensionContext, Position, window, Range, Uri } from "vscode";

import { HOST } from "src";
import { EditConfigurationSelection } from "./types/messages/webviewToHostMessages";

export const create = async (
  context: ExtensionContext,
  path: string,
  port: number,
  subcommand: string = "ui",
): Promise<[string, string[]]> => {
  const executable = await getExecutableBinary(context);
  return [executable, [subcommand, "-vv", `--listen=${HOST}:${port}`, path]];
};

const getExecutableBinary = (context: ExtensionContext): string => {
  return path.join(context.extensionPath, "bin", "publisher");
};

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
