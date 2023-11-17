import * as vscode from 'vscode';

const EXECUTABLE_DEFAULT = "publisher";

export type Command = string;

export const create = (path: string, port: number, subcommand: string = "publish-ui"): Command => {
    const configuration =  vscode.workspace.getConfiguration('positron');
    let executable: string = configuration.get<string>('publisher.executable.path', EXECUTABLE_DEFAULT);
    if (!executable) {
        executable = EXECUTABLE_DEFAULT;
    }

    return `${executable} ${subcommand} --listen=127.0.0.1:${port} ${path}`;
};
