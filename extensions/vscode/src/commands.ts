// Copyright (C) 2024 by Posit Software, PBC.

import * as path from "path";

import { ExtensionContext, Uri } from "vscode";

import { HOST } from "src";

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
