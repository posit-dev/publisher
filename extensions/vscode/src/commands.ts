import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { HOST } from '.';

const CONFIG_KEY = 'publisher.executable.path';

export const create = async (context: vscode.ExtensionContext, path: string, port: number, subcommand: string = "ui"): Promise<[string, string[]]> => {
  const executable = await getExecutableBinary(context);
  return [executable, [subcommand, '-v', `--listen=${HOST}:${port}`, path]];
};

const getExecutableBinary = async (context: vscode.ExtensionContext): Promise<string> => {
  const configuration = vscode.workspace.getConfiguration('posit');
  let executable: string | undefined = configuration.get<string>(CONFIG_KEY);
  if (executable) {
    try {
      await fs.access(executable, fs.constants.X_OK);
      return executable;
    } catch {
      vscode.window.showErrorMessage(
        `
                Error: Configuration Property Not Set Correctly

                It seems that the configuration property 'posit.${CONFIG_KEY}' is not set correctly in your settings. To resolve this issue, please follow these steps:

                1. Open your settings by clicking on the gear icon in the bottom left corner and selecting "Settings" or by using the shortcut 'Ctrl + ,'.

                2. Navigate to the extension settings by clicking on the "Extensions" icon in the sidebar and selecting your extension.

                3. Search for the configuration property 'posit.${CONFIG_KEY}' and ensure it is set correctly.

                Example:
                "posit.${CONFIG_KEY}": "/usr/local/bin/publisher"
                `,
        { modal: true }
      );
    }
  }
  return path.join(context.extensionPath, "bin", "publisher");
};
