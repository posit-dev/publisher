// Copyright (C) 2024 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";

import { ExtensionContext, workspace, window } from "vscode";

import { HOST } from "src";

const CONFIG_KEY_EXECUTABLE_PATH = "executablePath";

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
  const configuration = workspace.getConfiguration("positPublisher");
  let executable: string | undefined = configuration.get<string>(
    CONFIG_KEY_EXECUTABLE_PATH,
  );
  if (executable) {
    try {
      await fs.access(executable, fs.constants.X_OK);
      return executable;
    } catch {
      window.showErrorMessage(
        `
                Error: Configuration Property Not Set Correctly

                It seems that the configuration property 'posit.${CONFIG_KEY_EXECUTABLE_PATH}' is not set correctly in your settings. To resolve this issue, please follow these steps:

                1. Open your settings by clicking on the gear icon in the bottom left corner and selecting "Settings" or by using the shortcut 'Ctrl + ,'.

                2. Navigate to the extension settings by clicking on the "Extensions" icon in the sidebar and selecting your extension.

                3. Search for the configuration property 'posit.${CONFIG_KEY_EXECUTABLE_PATH}' and ensure it is set correctly.

                Example:
                "posit.${CONFIG_KEY_EXECUTABLE_PATH}": "/usr/local/bin/publisher"
                `,
        { modal: true },
      );
    }
  }
  return path.join(context.extensionPath, "bin", "publisher");
};
