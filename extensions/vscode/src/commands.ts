import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { HOST } from '.';

const CONFIG_KEY = 'publisher.executable.path';

export type Command = string;

export const create = async (context: vscode.ExtensionContext, path: string, port: number, subcommand: string = "ui"): Promise<Command> => {
    const executable = await getExecutableBinary(context);
    return `${executable} ${subcommand} -v --listen=${HOST}:${port} ${path}`;
};

const getExecutableBinary = async (context: vscode.ExtensionContext): Promise<string> => {
    const configuration =  vscode.workspace.getConfiguration('posit');
    let executable: string | undefined = configuration.get<string>(CONFIG_KEY);
    if (executable) {
        try {
            await fs.access(executable, fs.constants.X_OK);
            return executable;
        } catch {
            vscode.window.showErrorMessage(
                `
                The user does not have executable access to '${executable}'.\n
                This option is configured via '${CONFIG_KEY}'.\n
                Is it set to correct value?
                `,
                { modal: true }
            );
        }
    }
    return path.join(context.extensionPath, "bin", "publisher");
};
