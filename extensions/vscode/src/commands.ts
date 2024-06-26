// Copyright (C) 2024 by Posit Software, PBC.

import * as path from "path";

import { ExtensionContext } from "vscode";

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

const getExecutableBinary = async (
  context: ExtensionContext,
): Promise<string> => {
  return path.join(context.extensionPath, "bin", "publisher");
};
